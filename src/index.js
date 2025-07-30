const HTML_CONTENT = `<!DOCTYPE html>
<html>
<head>
    <title>DStats - Request Statistics</title>
    <script src="https://code.highcharts.com/highcharts.js"></script>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        h1 { 
            color: #333; 
            text-align: center; 
            margin-bottom: 30px; 
        }
        #chart { 
            height: 400px; 
            margin: 20px 0; 
        }
        .refresh-btn {
            background: #007cba;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .refresh-btn:hover {
            background: #005a87;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>DStats - Request Statistics</h1>
        <button class="refresh-btn" onclick="loadStats()">Refresh Data</button>
        <div id="chart"></div>
    </div>
    <script src="/stats.js"></script>
</body>
</html>`;

const JS_CONTENT = `let chart;

function initChart() {
    chart = Highcharts.chart('chart', {
        chart: {
            type: 'line',
            animation: false
        },
        title: {
            text: 'Requests per Minute (Last 60 minutes)'
        },
        xAxis: {
            type: 'category',
            labels: {
                rotation: -45,
                style: {
                    fontSize: '10px'
                }
            }
        },
        yAxis: {
            title: {
                text: 'Number of Requests'
            },
            min: 0
        },
        legend: {
            enabled: false
        },
        plotOptions: {
            line: {
                dataLabels: {
                    enabled: false
                },
                marker: {
                    enabled: true,
                    radius: 3
                }
            }
        },
        series: [{
            name: 'Requests',
            color: '#007cba',
            data: []
        }]
    });
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        const chartData = data.map(item => [item.time, item.requests]);
        
        chart.series[0].setData(chartData);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initChart();
    loadStats();
    
    setInterval(loadStats, 30000);
});`;

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        if (url.pathname === '/stats') {
            return new Response(HTML_CONTENT, {
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        if (url.pathname === '/stats.js') {
            return new Response(JS_CONTENT, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }
        
        if (url.pathname === '/api/stats') {
            const stats = await getStats(env.STATS_KV);
            return new Response(JSON.stringify(stats), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        await incrementCounter(env.STATS_KV);
        
        return new Response('Request recorded', {
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};

async function incrementCounter(kv) {
    const now = new Date();
    const minute = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    
    const current = await kv.get(`req-${minute}`);
    const count = current ? parseInt(current) + 1 : 1;
    
    await kv.put(`req-${minute}`, count.toString(), { expirationTtl: 86400 });
}

async function getStats(kv) {
    const now = new Date();
    const stats = [];
    
    for (let i = 59; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        const minute = `${time.getFullYear()}-${(time.getMonth()+1).toString().padStart(2,'0')}-${time.getDate().toString().padStart(2,'0')} ${time.getHours().toString().padStart(2,'0')}:${time.getMinutes().toString().padStart(2,'0')}`;
        
        const count = await kv.get(`req-${minute}`);
        stats.push({
            time: minute,
            requests: count ? parseInt(count) : 0
        });
    }
    
    return stats;
}
