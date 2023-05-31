import {getNetworkName} from "../utils/utils";
import path from "path";
import fs from "fs";

export function saveAddress(chainId: number, contractName: string, address: string) {
    const networkName = getNetworkName(chainId);
    const outputPath = path.join(__dirname, `../../deployed/network/${networkName}/${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({address: address, network: chainId}, null, 4));
}
