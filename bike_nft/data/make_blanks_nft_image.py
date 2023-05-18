import json

from pathlib import Path

from PIL.Image import Image
from bugs import mkdir

from make_blanks_collection_image import make_image_plain_text
from infura import send_to_infura


def image_to_buffer(image: Image):
    from io import BytesIO
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


def main():
    texts = {
        authority: "\n".join(["On-chain", "bicycle registration", "BLANK NFT", authority])
        for authority in ["A", "B", "C", "D", "--"]
    }

    images = {
        k: image_to_buffer(make_image_plain_text(text))
        for (k, text) in texts.items()
    }

    manifest = send_to_infura(pin=True, files=images)

    with (mkdir(Path(__file__).with_suffix('')) / "manifest.json").open(mode='w') as fd:
        json.dump(manifest, fd, indent=2)


if __name__ == '__main__':
    main()
