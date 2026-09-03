const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('Set TELEGRAM_BOT_TOKEN in the environment before running this script.');
    process.exit(1);
}

https.get(`https://api.telegram.org/bot${token}/getMe`, (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => {
        console.log(JSON.parse(data).result.username);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
