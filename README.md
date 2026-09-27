# AnimeStreetFighter Rebirth — Online

최신 **v7.4 / 14명** 실행본의 온라인 배포 브랜치입니다. 브랜치: `codex/rebirth-online`.

## 온라인 서버 배포

Render에서 **새 Web Service**를 만들고 `LonelyDawnStar/AnimeStreetFighter` 저장소의 `codex/rebirth-online` 브랜치를 선택합니다.

| 설정 | 값 |
| --- | --- |
| Language | Node |
| Region | Singapore |
| Root Directory | 비워두기 |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Instance Type | Free |
| Node version | 22 이상 |

`render.yaml`과 `render-rebirth.yaml`에도 같은 설정을 제공합니다. 이 브랜치의 Blueprint는 자동 배포를 끄므로 이후 업데이트는 준비된 커밋을 수동 배포합니다. 기존 `main` 브랜치의 Python 서비스에는 영향이 없습니다.

서버 배포 완료 후 Render가 표시하는 HTTPS 주소를 엽니다. 화면에 **v7.4 / 14 FIGHTERS**가 표시되면 최신 실행본입니다. `/`와 `/rebirth/` 모두 지원합니다.

## 친구와 플레이

1. 같은 서버 주소를 연 뒤 캐릭터와 이름을 정합니다.
2. 한 명이 **온라인 방 만들기**를 선택합니다.
3. 초대 링크를 복사해서 친구에게 전달하거나 6자리 방 코드를 알려줍니다.
4. 친구가 방에 참가하고 두 명 모두 준비하면 대전이 시작됩니다.

방과 전투 상태는 서버 메모리에 있으므로 인스턴스를 1개로 운영합니다. 연결이 잠깐 끊기면 30초 동안 재접속을 지원하며, 서버 자체가 재시작되거나 재배포되면 기존 방은 종료됩니다.

## 로컬 실행

```sh
npm ci
npm start
```

Windows 자동 실행은 `start_rebirth.bat`를 사용할 수 있습니다. [실행 안내](rebirth/RUN-LOCAL.md) · [v7.4 변경 내역](rebirth/PATCH-V74.md).

## 검증 및 출처

배포 실행 파일은 개발본 커밋 `1c970d2`에서 복사했으며, 공개 실행 파일의 SHA-256 일치를 확인했습니다. v7.4 전체 테스트 118/118 통과. 온라인 배포 준비 중 실제 WebSocket 두 클라이언트를 사용하는 서버·네트워크 테스트 26/26을 다시 통과했습니다.

```sh
npm test
```

GitHub 업로드 완료와 실제 서버 배포 완료는 별개입니다. 공개 플레이 주소는 Render 배포가 성공한 뒤 생성됩니다.
