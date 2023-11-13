// script.js

const typeCount = {};
let isWarpEnabled = false; // 新增一個變數來儲存 Warp 的狀態

async function getColo(url) {
  try {
    const start = performance.now();
    const response = await fetch("//" + url + "//cdn-cgi/trace");
    const text = await response.text();

    const regexColo = /colo=([\w]+)/;
    const matchColo = text.match(regexColo);

    // 新增檢查 Warp 的程式碼
    const regexWarp = /warp=([\w]+)/;
    const matchWarp = text.match(regexWarp);
    isWarpEnabled = matchWarp && matchWarp[1].toLowerCase() === 'on';

    const end = performance.now();
    const duration = end - start;

    return [matchColo[1], Math.round(duration) + ' ms'];
  } catch (error) {
    return "無法偵測";
  }
}

async function fetchAllUrls(urls, airportData) {
    // 顯示載入中
    document.querySelector("#result").innerHTML = '<tr><td colspan="4" class="text-center">結果載入中...</td></tr>';
  
    // 新增判斷是否使用 Warp 的訊息
    const warpMessage = isWarpEnabled ? "您當前正在使用 Warp" : "您當前未使用 WARP";
    const warpStatusElement = document.querySelector("#warpStatus");
    warpStatusElement.innerHTML = `<p style="color: ${isWarpEnabled ? '#008000' : '#FF0000'};">${warpMessage}</p>`;

    const promises = urls.map(async (data) => {
      const colo = await getColo(data['url']);
      const city = airportData[colo[0]] || '';
  
      if (!typeCount[data['type']]) {
        typeCount[data['type']] = 1;
      } else {
        typeCount[data['type']]++;
      }
  
      let delayColor = ''; // Default color
  
      const delay = parseInt(colo[1]);
  
      if (delay < 100) {
        delayColor = '#32CD32'; // Green
      } else if (delay >= 100 && delay < 300) {
        delayColor = '#DAA520'; // Yellow
      } else if (delay >= 300 && delay < 1000) {
        delayColor = '#F08080'; // Light Coral
      } else {
        delayColor = '#FF0000'; // Red
      }
  
      return `
        <tr>
          <td class="text-center">${data['type']}</td>
          <td class="text-center">${data['url']}</td>
          <td class="text-center"><strong>${colo[0]}</strong> (${city})</td>
          <td class="text-center" style="color: ${delayColor}">${colo[1]}</td>
        </tr>
      `;
    });
  
    const rows = await Promise.all(promises);
  
    document.querySelector("#result").innerHTML = rows.join('');
  }

  (async () => {
    const serverListResponse = await fetch('server_list.json');
    const urls = await serverListResponse.json();
    urls.sort((a, b) => a.url.localeCompare(b.url));
  
    const airportDataResponse = await fetch('cf.json');
    const airportData = await airportDataResponse.json();
  
    urls.sort((a, b) => {
      const typeOrder = { Free: 1, Pro: 2, Business: 3, Enterprise: 4 };
      return typeOrder[a.type] - typeOrder[b.type];
    });
    await fetchAllUrls(urls, airportData);
  })();
