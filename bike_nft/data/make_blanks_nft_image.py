from pathlib import Path

from bugs import mkdir

from make_blanks_collection_image import make_and_upload_image


def main():
    text = "\n".join(["On-chain", "bicycle registration", "BLANK NFT"])

    make_and_upload_image(text, local_path=mkdir(Path(__file__).with_suffix('')))


if __name__ == '__main__':
    main()
