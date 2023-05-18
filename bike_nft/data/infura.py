import os
import json
import dotenv
import requests

dotenv.load_dotenv()

INFURA_IPFS_ENDPOINT = os.environ['INFURA_BIKE_IPFS_ENDPOINT']


def send_to_infura(pin: bool, files: dict):
    print("Will upload the following files: ", list(files))

    if not input("Proceed?.. ").startswith("y"):
        print("Aborting.")
        exit(0)

    response = requests.post(
        f"{INFURA_IPFS_ENDPOINT}/api/v0/add?pin={str(pin).lower()}&wrap-with-directory=true",
        auth=(os.environ['INFURA_BIKE_IPFS_APIKEY'], os.environ['INFURA_BIKE_IPFS_SECRET']),
        files=files,
    )

    items = [json.loads(x) for x in response.text.split('\n') if x]

    [folder, *files] = sorted(items, key=(lambda x: x['Name']))

    return {'folder': folder, 'files': files}
