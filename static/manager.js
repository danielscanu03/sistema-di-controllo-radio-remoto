	 /**
     * Custom plugin to draw centered text in doughnut charts with defensive checks.
     */
    const centerTextPlugin = {
      id: 'centerText',
      beforeDraw: function(chart) {
        if (
          chart.config &&
          chart.config.options &&
          chart.config.options.elements &&
          chart.config.options.elements.center
        ) {
          const ctx = chart.ctx;
          const centerConfig = chart.config.options.elements.center;
          const txt = centerConfig.text || "";
          const fontStyle = centerConfig.fontStyle || 'Arial';
          const color = centerConfig.color || '#000';
          let fontSize = centerConfig.fontSize || 20;
          const sidePadding = centerConfig.sidePadding || 20;
          const sidePaddingCalculated = (sidePadding / 100) * (chart.innerRadius * 2);
  
          ctx.font = `bold ${fontSize}px ${fontStyle}`;
          const stringWidth = ctx.measureText(txt).width;
          const elementWidth = (chart.innerRadius * 2) - sidePaddingCalculated;
          const widthRatio = elementWidth / stringWidth;
          fontSize = Math.min(fontSize, Math.floor(fontSize * widthRatio));
  
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
  
          ctx.font = `bold ${fontSize}px ${fontStyle}`;
          ctx.fillStyle = color;
          ctx.fillText(txt, centerX, centerY);
        }
      }
    };
  
    // Register the custom plugin with Chart.js.
    Chart.register(centerTextPlugin);
  
    // Define the total available heap memory (adjust as needed for your device).
  
    let heapChart, spiffsChart;
  
    // Function to create/update the charts with the latest stats.
    function createCharts(HeapData, spiffsData, cpu, flashSize) {
      const usedHeap = HeapData.totalBytes - HeapData.freeBytes;
      const heapCtx = document.getElementById('heapChart').getContext('2d');
      if (heapChart) { heapChart.destroy(); }
      heapChart = new Chart(heapCtx, {
        type: 'doughnut',
        data: {
          labels: ['Free Heap', 'Used Heap'],
          datasets: [{
            data: [HeapData.freeBytes, usedHeap],
            backgroundColor: ['#27ae60', '#c0392b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          animation: { // Disable animations
            duration: 0
          },
          elements: {
            // Center text configuration shows CPU frequency.
            center: {
              text: cpu.Freq + " MHz\n" + cpu.Load + "%",
              color: '#34495e',
              fontStyle: 'Arial',
              sidePadding: 20,
              fontSize: 20
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 21 } }
            }
          }
        }
      });
  
      // Create the SPIFFS usage chart.
      const spiffsFree = spiffsData.totalBytes - spiffsData.usedBytes;
      const spiffsCtx = document.getElementById('spiffsChart').getContext('2d');
	  
	  let sizeMB = flashSize / (1024 * 1024);

	let flashSizetext;
	if (sizeMB >= 4096) {
		// sopra i 4 GB mostro in GB
		let sizeGB = flashSize / (1024 * 1024 * 1024);
		flashSizetext = sizeGB.toFixed(2) + " GB";
	} else {
		// altrimenti mostro in MB
		flashSizetext = sizeMB.toFixed(2) + " MB";
	}
	  
	  
      if (spiffsChart) { spiffsChart.destroy(); }
      spiffsChart = new Chart(spiffsCtx, {
        type: 'doughnut',
        data: {
          labels: ['Used SPIFFS', 'Free SPIFFS'],
          datasets: [{
            data: [spiffsData.usedBytes, spiffsFree],
            backgroundColor: ['#e67e22', '#16a085']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          animation: { // Disable animations
            duration: 0
          },
          elements: {
            // Center text configuration shows CPU frequency.
            center: {
              text: flashSizetext,
              color: '#34495e',
              fontStyle: 'Arial',
              sidePadding: 20,
              fontSize: 20
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 14 } }
            }
          }
        }
      });
    }
  
    // Function to fetch stats from the ESP32 /stats endpoint and update the charts.
    function updateCharts() {
      fetch('/stats')
        .then(response => response.json())
        .then(data => {
          // Expected data: freeHeap, cpuFreq, totalBytes, usedBytes.
          createCharts({
            totalBytes:data.HeapSize,
            freeBytes: data.freeHeap
          }, { 
            totalBytes: data.totalBytes, 
            usedBytes: data.usedBytes 
          }, {
            Freq: data.cpuFreq, 
            Load: data.cpuLoad
          },data.flashSize );
        })
        .catch(err => console.error("Failed to update charts:", err));
    }
  
    // Update charts on load and every 10 seconds.
    updateCharts();
    setInterval(updateCharts, 1000);
  
    // Manual refresh button handler.
    document.getElementById('refreshCharts').addEventListener('click', updateCharts);