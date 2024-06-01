const { Telnet } = require('telnet-client');

async function getIpv4AddressFromRTXRouter(routerIp, routerPort, routerPassword) {
    let connection = new Telnet();
    let params = {
        host: routerIp,
        port: routerPort,
        negotiationMandatory: false,
        timeout: 1500,
        shellPrompt: '> ',
        loginPrompt: 'Password: ',
        password: routerPassword,
        initialLFCR: true,
    };

    try {
        await connection.connect(params);

        // 初期プロンプトの待機
        await connection.exec('');
        await connection.exec('');
        let res = await connection.exec('show status pp 1\n'); // 改行を追加

        await connection.end();

        let match = res.match(/PP IP Address Local: (\d+\.\d+\.\d+\.\d+),/);
        if (match) {
            return match[1];
        } else {
            throw new Error('IP address not found in response');
        }
    } catch (error) {
        console.error('Error fetching IPv4 address from router:', error);
        throw error;
    }
}

module.exports = { getIpv4AddressFromRTXRouter };
