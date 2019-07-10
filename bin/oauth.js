let request = require('request-promise-native');
const config = require('../config/config.json');

if (process.argv.length !== 3) {
    console.error('Missing redirect value');
    process.exit(1);
}

const OSU_SERVER = 'https://osu.ppy.sh/';
const jar = request.jar();
jar.setCookie(`__cfduid=${config.cloudflare.id}`, OSU_SERVER);
jar.setCookie(`cf_clearance=${config.cloudflare.clearance}`, OSU_SERVER);
jar.setCookie(`osu_session=${config.session}`, OSU_SERVER);
jar.setCookie(`XSRF-TOKEN=${config.csrf}`, OSU_SERVER);
request = request.defaults({
    baseUrl: OSU_SERVER,
    method: 'POST',
    followRedirect: false,
    headers: {
        'User-Agent': config.userAgent,
        'X-CSRF-TOKEN': config.csrf
    },
    jar: jar
});

(async () => {
    const client = await request({
        uri: '/oauth/clients',
        form: {
            name: 'Project Loved Website',
            redirect: process.argv[2]
        }
    });

    console.log(client);
})();
