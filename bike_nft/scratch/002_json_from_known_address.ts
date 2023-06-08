import {deployed} from "../deploy.config";

// iterate over deployed
for (const [networkName, contracts] of Object.entries(deployed)) {
    console.log(networkName);

    const path = __dirname + `/../deployed/network/${networkName}`;

    for (const [contractName, contractAddress] of Object.entries(contracts)) {
        const path = `../deployed/network/${networkName}/${contractName}.json`;

        let contractDataJson;

        try {
            // read JSON
            const fs = require('fs');
            const contractDataJson = JSON.parse(fs.readFileSync(path, 'utf8'));
        } catch (e) {
            console.log(`Error: ${path} ...`);

            if (contractAddress) {
                contractDataJson = {
                    address: contractAddress
                }

                // write to file
                const fs = require('fs');
                const data = JSON.stringify(contractDataJson, null, 4);
                // fs.writeFileSync(path, data);

                console.log(`Wrote: ${path}`);
            }
        }
    }
}
