const http = require('http');
const crypto = require('crypto');
const Router = require('router');
const bodyParser = require('body-parser');

const opts = { mergeParams: true };
const users = [];
let sessionStore = [];

function getCookie(req) {
    return req.rawHeaders[req.rawHeaders.indexOf('Cookie') + 1].split('=')[1];
}

async function main() {
    const page = Router();
    const user = Router(opts);
    const main = Router(opts).use(page).use(user);

    user.use(bodyParser.json());

    page.get('/', (req, res) => {
        res.end('home page!');
    });

    page.get('/your-page', (req, res) => {
        const ssid = getCookie(req);

        const user = sessionStore.find((s) => s.ssid === ssid);

        if (!user) {
            res.statusCode = 401;
            return res.end(
                'only logged in user can view their personalized page!'
            );
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<h1>Your role is: ${user.role}</h1>`);
    });

    user.post('/register', (req, res) => {
        const { username, password, role } = req.body;

        const user = users.find((u) => u.username === username);

        if (user) {
            return res.end('user already exists!');
        }

        users.push({ username, password, role });
        res.end('user created!');
    });

    user.post('/logout', (req, res) => {
        const ssid = getCookie(req);

        sessionStore = sessionStore.filter((u) => u.ssid !== ssid);

        res.end('logged out!');
    });

    user.post('/login', (req, res) => {
        const { username, password } = req.body;

        const user = users.find((u) => u.username === username);

        if (user && user.password === password) {
            const sessionId = crypto.randomBytes(64).toString('hex');

            sessionStore.push({ ssid: sessionId, role: user.role });

            res.setHeader(
                'Set-Cookie',
                `ssId=${sessionId}; Max-Age=60; Domain=localhost`
            );

            res.end('user logged In');
        } else {
            return res.end('user does not match any data!');
        }
    });

    main.use((req, res) => {
        res.statusCode = 404;
        res.end('unknwon endpoint');
    });

    return http.createServer(function (req, res) {
        console.log(req.url + '\n', req.rawHeaders);
        console.log(sessionStore);
        main(req, res, function (req, res) {});
    });
}

main()
    .then((server) => {
        server.listen(8080);
    })
    .catch((err) => console.log(err));
