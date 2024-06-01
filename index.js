const fs = require('fs');
const axios = require('axios');
const cron = require('node-cron');
const { getIpv4AddressFromRTXRouter } = require('./rtxgrabber');
const { exec } = require('child_process');

const setting = JSON.parse(fs.readFileSync('./setting.json'));

const updateCronExpression = setting.update;

const accessToken = setting.accessToken;
const accessTokenSecret = setting.accessTokenSecret;

const resourceId = setting.resourceId;

const apiRoot = 'https://secure.sakura.ad.jp/cloud/zone/tk1a/api/cloud/1.1/';

const recordNames = setting.recordNames;

const appraiser = setting.appraiser;

async function getIpv4Address() {
    if (setting.useRtx) {
        return await getIpv4AddressFromRTXRouter(setting.routerIp, setting.routerPort, setting.routerPassword);
    } else {
        const response = await axios.get(appraiser, {
            headers: { "User-Agent": setting.userAgent },
            data: {}
        });

        return response.data;
    }
}

async function getRecordSets() {
    const response = await axios.get(apiRoot + 'commonserviceitem/' + resourceId,{
        auth: {
            username: accessToken,
            password: accessTokenSecret
        }
    });
    return response.data.CommonServiceItem.Settings.DNS.ResourceRecordSets;
}

function changeRecordSets(recordSets, address) {
    for (const recordName of recordNames) {
        recordSets.map((rcd) => {
            if(rcd.Name === recordName) {
                rcd.RData = address;
            }
        });
    }

    return recordSets;

}

async function putSetting(recordSets) {
    const data = {
        "CommonServiceItem" : {
            "Settings" : {
                "DNS" : {
                    "ResourceRecordSets" : recordSets
                }
            }
        }
    }

    const response = await axios({
        method: 'put',
        url: apiRoot + 'commonserviceitem/' + resourceId,
        auth: {
            username: accessToken,
            password: accessTokenSecret
        },
        data: data
        
    });

    return response.data;

}

function onIpChange(newIp) {
    const scriptPath = './hook.sh'; // コールバックで実行するbashスクリプトのパス
    exec(`bash ${scriptPath} ${newIp}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error}`);
            return;
        }
        console.log(`Script output: ${stdout}`);
        if (stderr) {
            console.error(`Script error output: ${stderr}`);
        }
    });
}

(async() => {
    let address = await getIpv4Address();
    console.log(new Date, "address=", address)
    let recordSets = await getRecordSets();

    recordSets = changeRecordSets(recordSets, address);
    console.log('update...');
    await putSetting(recordSets);
    console.log('done!');

    onIpChange(address);

    cron.schedule(updateCronExpression, async() => {
        const currentAddress = await getIpv4Address();
        console.log(new Date, "address=", currentAddress)
        if(address !== currentAddress){
            address = currentAddress;
            console.log('update...');
            recordSets = await getRecordSets();
            recordSets = changeRecordSets(recordSets, address);
            await putSetting(recordSets);
            console.log('done!');

            onIpChange(address);
        }
    });
    
})();
