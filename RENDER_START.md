# Render 첫 배포 — v0.32 Render 패키지

게임 내용은 v0.32와 같습니다. 이 패키지는 배포 설정과 안내를 추가했습니다.

## 1. GitHub에 올리기

1. ZIP 압축을 풀고 grail-duel 폴더를 엽니다.
2. GitHub에 게임용 저장소를 만듭니다. Private 저장소도 Render 계정을 연결하면 사용할 수 있습니다.
3. 폴더 **안의 파일과 static 폴더**를 저장소에 올립니다. ZIP 자체를 올리지 마세요.
4. 저장소 첫 화면에 server.py, online.py, requirements.txt, render.yaml, static이 나란히 보여야 합니다. .python-version도 포함하세요.
5. 파일이 많으면 PC의 GitHub Desktop으로 폴더를 저장소로 만들어 Commit → Publish repository 하는 방식이 편합니다. 웹 업로드에서 크기 제한에 걸리면 GitHub Desktop을 사용하세요.

## 2. Blueprint로 배포

1. https://dashboard.render.com 에 로그인합니다.
2. New + → Blueprint를 선택하고 GitHub 계정을 연결합니다.
3. 위 저장소와 사용할 브랜치(main 등)를 선택합니다.
4. render.yaml 경로를 확인합니다. 설정이 읽히면 Python / Free / Singapore인지 확인하고 생성·배포합니다.
5. Logs에서 서버 시작을 확인하고 상태가 Live가 되면 서비스의 https://…onrender.com 주소로 접속합니다.

render.yaml은 무료 플랜, 싱가포르 지역, /health 상태 확인을 설정합니다. 자동 업데이트는 Off입니다. 최초 생성 시에는 배포됩니다.

## 3. Web Service를 직접 만드는 경우

Blueprint와 이 방식 중 하나만 사용하세요. 중복으로 만들 필요 없습니다.

| 항목 | 값 |
|---|---|
| Service type | Web Service (Static Site 아님) |
| Runtime / Language | Python 3 |
| Region | Singapore |
| Branch | 코드를 올린 브랜치 |
| Root Directory | 저장소 첫 화면에 server.py가 있다면 비워 두기 |
| Build Command | pip install -r requirements.txt |
| Start Command | python server.py --host 0.0.0.0 |
| Instance Type | Free |
| Health Check Path | /health |
| Auto-Deploy | Off |

.python-version 파일로 Python 3.12 계열을 선택합니다. 서버는 Render가 주는 PORT 환경 변수를 자동으로 읽습니다. PORT를 8000으로 고정하지 마세요. start.bat/start_online.bat/launcher.py는 PC 실행용이며 Render에서는 사용하지 않습니다.

게임 파일이 저장소의 grail-duel 하위 폴더에 있다면 직접 만드는 방식에서 Root Directory를 grail-duel로 설정하세요. Blueprint 방식은 위 1번의 저장소 루트 구조를 기준으로 만들었습니다.

## 4. 공개 접속 확인

- /health 주소에서 status: ok, version: 0.32가 표시되는지 확인합니다.
- 메뉴 그래픽이 모두 뜨는지 확인하고 AI 대전을 시작합니다.
- 다른 브라우저/기기로 같은 주소에 접속해 방 목록 → 참가 → 준비 → 코인 토스 → 픽 → 대전까지 확인합니다.
- PC 서버 콘솔을 종료하고 PC를 꺼도 Render 주소는 이용할 수 있습니다.
- 무료 서버는 유휴 상태에서 잠들 수 있으므로 첫 접속은 기다려 주세요. 항상 즉시 응답하는 상시 서버는 유료 플랜을 검토해야 합니다. 무료 사용 한도도 Render 대시보드에서 확인하세요.

## 5. 업데이트

1. 변경된 코드와 에셋을 같은 저장소·브랜치에 Commit/Push합니다.
2. 대전이 끝난 시간을 골라 Render 서비스 → Manual Deploy → Deploy latest commit을 실행합니다.
3. Live가 되면 같은 게임 주소에서 새로고침합니다.
4. 변경이 안 보이면 PC에서는 Ctrl+F5, 모바일에서는 페이지를 닫았다가 다시 엽니다.

자동화를 원하면 Auto-Deploy를 On Commit으로 바꾸세요. Blueprint 관리 시 render.yaml의 autoDeployTrigger도 commit으로 바꿉니다.

현재 게임은 하나의 프로세스가 방과 경기를 메모리에 보관합니다. 서버 재시작·재배포·무료 서버 종료 후에는 방과 진행 중 경기가 사라집니다. 여러 인스턴스 또는 여러 worker로 늘리지 마세요. 서버 용량이 부족하면 우선 단일 인스턴스의 자원을 늘리는 방식으로 운영합니다.

## 6. 문제 확인

- requirements.txt를 못 찾음: 저장소 폴더 구조와 Root Directory 확인.
- Python 빌드 오류: .python-version 업로드 여부와 Logs 확인.
- Static Site로 생성함: Python Web Service로 생성.
- 로비는 뜨는데 연결 오류: 같은 Render 주소로 접속했는지, Live인지 확인 후 Logs 확인.
- 잠든 서버의 첫 접속이 느림: 무료 플랜 동작. 계속 새 배포를 시작하지 말고 기다리세요.

## 검증 범위

이 패키지는 로컬에서 Render와 같은 실행 명령과 PORT 환경 변수를 사용해 서버 시작·HTTP·WebSocket을 검사합니다. 실제 Render 계정에 배포된 상태는 아닙니다. Render에서 배포한 뒤 4번의 공개 접속 확인이 필요합니다.

공식 자료 (2026-09-23 확인):
- https://render.com/docs/blueprint-spec
- https://render.com/docs/python-version
- https://render.com/docs/web-services
- https://render.com/docs/deploys
- https://render.com/docs/free
