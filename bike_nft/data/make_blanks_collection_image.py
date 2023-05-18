import json
from pathlib import Path

from bugs import mkdir

from PIL import Image, ImageDraw, ImageFont

from infura import send_to_infura

[FONTFILE] = Path(__file__).parent.glob("*/Poppins-*.ttf")


def make_image_plain_text(text):
    (W, H) = (512, 512)

    canvas = Image.new('RGB', (W, H), (255, 255, 255))

    draw = ImageDraw.Draw(canvas)

    font = ImageFont.truetype(str(FONTFILE), 36)

    props = dict(xy=(W / 2, H / 2), text=text, font=font, anchor="mm", align="center", spacing=8, fill=(0, 0, 0))
    # (l, t, r, b) = draw.textbbox(**props)

    draw.text(**props)

    return canvas


def upload_image(image: Path):
    return send_to_infura(pin=True, files={'image': image.open(mode='rb')})


def make_and_upload_image(text: str, local_path: Path):
    image = make_image_plain_text(text)

    image_file = local_path / "image.jpg"
    image.save(image_file, format="JPEG")

    manifest = upload_image(image_file)

    with (local_path / "manifest.json").open("w") as fd:
        json.dump(manifest, fd, indent=2)


def main():
    text = "\n".join(["On-chain", "bicycle registration", "BLANK NFTs", "collection"])

    make_and_upload_image(text, local_path=mkdir(Path(__file__).with_suffix('')))


if __name__ == '__main__':
    main()
