// Enhanced Cloudflare Network Test - v0.2.0

const typeCount = {};
let isWarpEnabled = false;
let testResults = [];
let currentSortColumn = -1;
let currentSortAsc = true;
const TEST_ROUNDS = 5; // 進行5次測試以提高準確性

// 主題切換
function toggleTheme() {
  const body = document.body;
  const icon = document.querySelector('.theme-toggle i');
  
  if (body.classList.contains('dark-mode')) {
    body.classList.remove('dark-mode');
    icon.className = 'fas fa-moon';
    localStorage.setItem('theme', 'light');
  } else {
    body.classList.add('dark-mode');
    icon.className = 'fas fa-sun';
    localStorage.setItem('theme', 'dark');
  }
}

// 載入儲存的主題
function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.querySelector('.theme-toggle i').className = 'fas fa-sun';
  }
}

// 更新進度條
function updateProgress(current, total, message) {
  const percent = (current / total) * 100;
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  progressFill.style.width = percent + '%';
  progressText.textContent = message || `測試進度: ${current}/${total}`;
}

// 計算標準差（用於抖動值）
function calculateStdDev(values) {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

// 單次延遲測試
async function testLatency(url) {
  try {
    const start = performance.now();
    const response = await fetch("//" + url + "/cdn-cgi/trace", {
      cache: 'no-cache',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error('Request failed');
    }
    
    const text = await response.text();
    const end = performance.now();
    const duration = end - start;

    const regexColo = /colo=([\w]+)/;
    const matchColo = text.match(regexColo);
    
    return {
      duration: duration,
      colo: matchColo ? matchColo[1] : null,
      text: text
    };
  } catch (error) {
    return null;
  }
}

// 多次測試取平均
async function testMultipleRounds(url, rounds = TEST_ROUNDS) {
  const results = [];
  let colo = null;
  let fullText = null;
  
  for (let i = 0; i < rounds; i++) {
    const result = await testLatency(url);
    if (result && result.duration) {
      results.push(result.duration);
      if (!colo && result.colo) {
        colo = result.colo;
        fullText = result.text;
      }
    }
    // 在測試之間添加小延遲，避免請求過快
    if (i < rounds - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  if (results.length === 0) {
    return null;
  }
  
  // 移除最大和最小值（如果有足夠的樣本）
  if (results.length >= 4) {
    results.sort((a, b) => a - b);
    results.shift(); // 移除最小值
    results.pop(); // 移除最大值
  }
  
  const avgDuration = results.reduce((a, b) => a + b, 0) / results.length;
  const jitter = calculateStdDev(results);
  
  // 檢查 WARP 狀態（只在第一次）
  if (fullText && isWarpEnabled === false) {
    const regexWarp = /warp=([\w]+)/;
    const matchWarp = fullText.match(regexWarp);
    if (matchWarp && matchWarp[1] !== 'off') {
      isWarpEnabled = true;
      updateWarpStatus(true);
    } else if (!isWarpEnabled) {
      updateWarpStatus(false);
    }
  }
  
  return {
    colo: colo,
    avgLatency: Math.round(avgDuration),
    jitter: Math.round(jitter * 10) / 10,
    successRate: (results.length / rounds * 100).toFixed(0)
  };
}

// 更新 WARP 狀態顯示
function updateWarpStatus(enabled) {
  const warpStatusElement = document.getElementById("warpStatus");
  const icon = enabled ? '<i class="fas fa-shield-halved"></i>' : '<i class="fas fa-globe"></i>';
  const message = enabled ? "您正在使用 Cloudflare WARP" : "您未使用 WARP";
  const className = enabled ? "warp-enabled" : "warp-disabled";
  
  warpStatusElement.innerHTML = `
    <div class="warp-badge ${className}">
      ${icon}
      <span>${message}</span>
    </div>
  `;
}

// 獲取延遲等級和顏色（Cloudflare 橘色主題）
function getLatencyInfo(latency) {
  if (latency < 50) {
    return { level: '優秀', color: '#10b981', icon: 'fa-face-smile' };
  } else if (latency < 100) {
    return { level: '良好', color: '#F6821F', icon: 'fa-face-smile' };
  } else if (latency < 200) {
    return { level: '一般', color: '#FFA500', icon: 'fa-face-meh' };
  } else if (latency < 400) {
    return { level: '較慢', color: '#f97316', icon: 'fa-face-frown' };
  } else {
    return { level: '很慢', color: '#ef4444', icon: 'fa-face-dizzy' };
  }
}

// 更新統計資訊
function updateStats() {
  const validResults = testResults.filter(r => r.result && r.result.avgLatency);
  
  if (validResults.length === 0) return;
  
  const latencies = validResults.map(r => r.result.avgLatency);
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  const bestLatency = Math.min(...latencies);
  const worstLatency = Math.max(...latencies);
  
  document.getElementById('avgLatency').textContent = avgLatency + ' ms';
  document.getElementById('bestLatency').textContent = bestLatency + ' ms';
  document.getElementById('worstLatency').textContent = worstLatency + ' ms';
  document.getElementById('testCount').textContent = validResults.length;
}

// 測試所有 URL
async function fetchAllUrls(urls, airportData) {
  testResults = [];
  const resultElement = document.querySelector("#result");
  const progressContainer = document.getElementById('progressContainer');
  
  progressContainer.style.display = 'block';
  resultElement.innerHTML = '<tr><td colspan="6" class="text-center loading-cell"><i class="fas fa-spinner fa-spin"></i> 正在進行網路測試，請稍候...</td></tr>';
  
  let completed = 0;
  const total = urls.length;
  
  // 逐個測試（避免同時發起太多請求）
  for (const data of urls) {
    updateProgress(completed, total, `正在測試 ${data.url} (${completed + 1}/${total})...`);
    
    const result = await testMultipleRounds(data.url);
    const city = result && result.colo ? (airportData[result.colo] || '未知') : '未知';
    
    testResults.push({
      type: data.type,
      url: data.url,
      result: result,
      city: city
    });
    
    completed++;
    updateProgress(completed, total, `已完成 ${completed}/${total} 項測試`);
    
    // 更新統計
    updateStats();
    
    // 即時顯示結果
    renderResults();
  }
  
  // 測試完成
  updateProgress(total, total, '測試完成！');
  setTimeout(() => {
    progressContainer.style.display = 'none';
  }, 2000);
}

// 渲染結果
function renderResults() {
  const resultElement = document.querySelector("#result");
  
  if (testResults.length === 0) {
    resultElement.innerHTML = '<tr><td colspan="6" class="text-center loading-cell">暫無數據</td></tr>';
    return;
  }
  
  const rows = testResults.map(data => {
    if (!data.result) {
      return `
        <tr class="result-row">
          <td class="text-center"><span class="badge badge-${data.type.toLowerCase()}">${data.type}</span></td>
          <td class="text-center"><a href="//${data.url}/cdn-cgi/trace" target="_blank" class="url-link">${data.url}</a></td>
          <td class="text-center">--</td>
          <td class="text-center error-text"><i class="fas fa-exclamation-triangle"></i> 連線失敗</td>
          <td class="text-center">--</td>
          <td class="text-center"><span class="status-badge status-error">失敗</span></td>
        </tr>
      `;
    }
    
    const latencyInfo = getLatencyInfo(data.result.avgLatency);
    const jitterClass = data.result.jitter < 10 ? 'jitter-good' : (data.result.jitter < 30 ? 'jitter-ok' : 'jitter-bad');
    
    return `
      <tr class="result-row">
        <td class="text-center"><span class="badge badge-${data.type.toLowerCase()}">${data.type}</span></td>
        <td class="text-center"><a href="//${data.url}/cdn-cgi/trace" target="_blank" class="url-link">${data.url}</a></td>
        <td class="text-center location-cell">
          <strong>${data.result.colo}</strong>
          <span class="city-name">${data.city}</span>
        </td>
        <td class="text-center latency-cell" style="color: ${latencyInfo.color}">
          <i class="fas ${latencyInfo.icon}"></i>
          <strong>${data.result.avgLatency} ms</strong>
        </td>
        <td class="text-center">
          <span class="${jitterClass}">±${data.result.jitter} ms</span>
        </td>
        <td class="text-center">
          <span class="status-badge" style="background-color: ${latencyInfo.color}">
            ${latencyInfo.level}
          </span>
        </td>
      </tr>
    `;
  });
  
  resultElement.innerHTML = rows.join('');
}

// 排序功能
function sortByLatency() {
  testResults.sort((a, b) => {
    const latencyA = a.result ? a.result.avgLatency : 999999;
    const latencyB = b.result ? b.result.avgLatency : 999999;
    return latencyA - latencyB;
  });
  renderResults();
}

function sortByColumn(columnIndex) {
  if (currentSortColumn === columnIndex) {
    currentSortAsc = !currentSortAsc;
  } else {
    currentSortColumn = columnIndex;
    currentSortAsc = true;
  }
  
  testResults.sort((a, b) => {
    let valA, valB;
    
    switch(columnIndex) {
      case 0: // 等級
        const typeOrder = { Free: 1, Pro: 2, Business: 3, Enterprise: 4 };
        valA = typeOrder[a.type] || 999;
        valB = typeOrder[b.type] || 999;
        break;
      case 1: // 網址
        valA = a.url;
        valB = b.url;
        break;
      case 2: // 來源
        valA = a.result ? a.result.colo : 'zzz';
        valB = b.result ? b.result.colo : 'zzz';
        break;
      case 3: // 延遲
        valA = a.result ? a.result.avgLatency : 999999;
        valB = b.result ? b.result.avgLatency : 999999;
        break;
      default:
        return 0;
    }
    
    if (typeof valA === 'string') {
      return currentSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return currentSortAsc ? valA - valB : valB - valA;
    }
  });
  
  renderResults();
}

// 開始測試
async function startTest() {
  const reloadButton = document.getElementById('reloadButton');
  reloadButton.disabled = true;
  reloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 測試中...';
  
  try {
    const serverListResponse = await fetch('server_list.json');
    const urls = await serverListResponse.json();
    
    const airportDataResponse = await fetch('cf.json');
    const airportData = await airportDataResponse.json();
    
    // 按等級排序
    urls.sort((a, b) => {
      const typeOrder = { Free: 1, Pro: 2, Business: 3, Enterprise: 4 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
    
    await fetchAllUrls(urls, airportData);
  } catch (error) {
    console.error('測試失敗:', error);
    document.querySelector("#result").innerHTML = '<tr><td colspan="6" class="text-center error-text">載入失敗，請重新整理頁面</td></tr>';
  } finally {
    reloadButton.disabled = false;
    reloadButton.innerHTML = '<i class="fas fa-rotate"></i> 重新測試';
  }
}

// 初始化
(async () => {
  loadTheme();
  await startTest();
})();
