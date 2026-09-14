const fs = require('fs');
const https = require('https');

(async () => {
    try {
        const fetch = globalThis.fetch;
        const agent = new https.Agent({ rejectUnauthorized: false });
        const dispatcher = { dispatcher: new (require('undici').Agent)({ connect: { rejectUnauthorized: false } }) };
        
        // 1. Get Login Page
        const loginUrl = "https://congchuc.quangninh.gov.vn/sso/Login.aspx";
        let res = await fetch(loginUrl, dispatcher);
        let html = await res.text();
        
        // Extract VIEWSTATE, VIEWSTATEGENERATOR, EVENTVALIDATION
        const extract = (name) => {
            const match = html.match(new RegExp(`id="${name}"\\s+value="([^"]+)"`));
            return match ? match[1] : '';
        };
        const viewState = extract('__VIEWSTATE');
        const viewStateGen = extract('__VIEWSTATEGENERATOR');
        const eventValidation = extract('__EVENTVALIDATION');
        
        // Extract Cookie
        let cookies = [];
        res.headers.forEach((v, k) => { if (k === 'set-cookie') cookies.push(v); });
        let cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
        
        // 2. Login
        const params = new URLSearchParams();
        params.append('__VIEWSTATE', viewState);
        params.append('__VIEWSTATEGENERATOR', viewStateGen);
        params.append('__EVENTVALIDATION', eventValidation);
        params.append('txtUsername', 'nguyenanhduc6');
        params.append('txtPassword', 'javaDev@97');
        params.append('btnLogin', 'Đăng nhập');
        
        res = await fetch(loginUrl, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieStr
            },
            ...dispatcher,
            redirect: 'manual'
        });
        
        let newCookies = [];
        res.headers.forEach((v, k) => { if (k === 'set-cookie') newCookies.push(v); });
        let authCookie = newCookies.map(c => c.split(';')[0]).join('; ') + '; ' + cookieStr;
        
        // 3. Go to documents page
        const docsUrl = "https://congchuc.quangninh.gov.vn/Default.aspx?tabid=1101";
        res = await fetch(docsUrl, {
            headers: { 'Cookie': authCookie },
            ...dispatcher
        });
        
        html = await res.text();
        fs.writeFileSync('local_dump.html', html);
        console.log('Done, saved to local_dump.html');
    } catch (e) {
        console.error(e);
    }
})();
