const http = require('http');
const crypto = require('crypto');
const Router = require('router');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const keys = require('./secret.json');

const pool = new Pool({
    host: 'localhost',
    user: keys.username,
    database: 'sessions',
    password: keys.password,
    port: 5555,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

const opts = { mergeParams: true };
let sessionStore = [],
    res;

function getCookie(req) {
    return req.rawHeaders[req.rawHeaders.indexOf('Cookie') + 1].split('=')[1];
}

function errorHandler(res, error = new Error('server error!')) {
    console.log(error.message);
    res.statusCode = 500;
    res.end(error.message);
}

async function main() {
    const page = Router();
    const user = Router(opts);
    const api = Router(opts).use(page).use(user);

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

    user.post('/register', async (req, res) => {
        const { username, password, role } = req.body;

        const result = await pool.query(
            'SELECT COUNT(*) FROM users where username=$1',
            [username]
        );

        if (result.rows[0].count === '1') {
            return res.end('user already exists!');
        }

        await pool.query(
            'INSERT INTO users(username, password, role) values ($1, $2, $3)',
            [username, password, role]
        );

        res.end('user created!');
    });

    user.post('/logout', (req, res) => {
        const ssid = getCookie(req);

        sessionStore = sessionStore.filter((u) => u.ssid !== ssid);

        res.end('logged out!');
    });

    user.post('/login', async (req, res) => {
        const { username, password } = req.body;

        const {
            rows: [user],
        } = await pool.query(
            'SELECT password, user_id, role FROM users where username=$1',
            [username]
        );

        if (user && user.password === password) {
            const sessionId = crypto.randomBytes(64).toString('hex');

            sessionStore.push({
                ssid: sessionId,
                role: user.role,
                id: user.user_id,
            });

            res.setHeader(
                'Set-Cookie',
                `ssId=${sessionId}; Max-Age=60; Domain=localhost`
            );

            res.end('user logged In');
        } else {
            return res.end('user does not match any data!');
        }
    });

    api.use((req, res) => {
        res.statusCode = 404;
        res.end('unknwon endpoint');
    });

    return http
        .createServer(function (req, res) {
            console.log(req.url + '\n', req.rawHeaders);
            api(req, res, function (req, res) {});
        })
        .on('error', (err) => {});
}

main()
    .then((server) => {
        server.listen(8080);
    })
    .catch((err) => console.log(err));
