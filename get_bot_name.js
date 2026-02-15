const https = require('https');

https.get('https://api.telegram.org/bot8270333686:AAEaQLlEmewJeVQ2FSZXDHrOFx_0eN4JQfI/getMe', (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => {
        console.log(JSON.parse(data).result.username);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
