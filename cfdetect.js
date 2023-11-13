// script.js

const typeCount = {};

async function getColo(url) {
  try {
    const start = performance.now();
    const response = await fetch("//" + url + "//cdn-cgi/trace");
    const text = await response.text();

    const regex = /colo=([\w]+)/;
    const match = text.match(regex);
    const end = performance.now();
    const duration = end - start;

    return [match[1], Math.round(duration) + ' ms'];
  } catch (error) {
    return "無法偵測";
  }
}

async function fetchAllUrls(urls, airportData) {
    // 顯示載入中
    document.querySelector("#result").innerHTML = '<tr><td colspan="4" class="text-center">結果載入中...</td></tr>';
  
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

  const airportDataResponse = await fetch('cf.json');
  const airportData = await airportDataResponse.json();

  await fetchAllUrls(urls, airportData);
})();
