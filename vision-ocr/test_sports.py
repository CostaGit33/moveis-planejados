from pathlib import Path
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from sports import process_sports_image, _validate


def main():
    result = process_sports_image(Image.open('/home/ubuntu/upload/Screenshot_2025-08-01-20-36-01-434_com.android.chrome.jpg'))
    print('mode:', result['mode'])
    print('statistics:', result['statistics'])
    print('score:', result['score'])
    print('validation:', result['validation'])
    assert result['mode'] == 'sports_statistics'
    assert 'statistics' in result

    valid = _validate({'possession': [48, 52], 'attacks': [104, 113]}, [0, 0])
    assert valid['possession_sum'] == 100
    assert valid['requires_manual_review'] is False

    invalid = _validate({'possession': [48, 51]}, None)
    assert 'possession_not_100' in invalid['issues']
    assert invalid['requires_manual_review'] is True
    print('validation tests: ok')


if __name__ == '__main__':
    main()
