# Moveis Planejados — Vision OCR

Microserviço de visão para o projeto de móveis planejados.

## Stack

- Python 3.12
- FastAPI
- OpenCV
- Tesseract OCR (português + inglês)
- Pillow

## Endpoints

- `GET /health`
- `POST /process-image` com campo multipart `image`

## Deploy no EasyPanel

Crie um App conectado ao repositório `CostaGit33/moveis-planejados`.

Configure o **Build Path/Context** para `vision-ocr` (ou use o Dockerfile `vision-ocr/Dockerfile`) e a porta interna `8000`.

Depois do deploy, valide `GET /health` antes de conectar o n8n.

## Segurança

Este serviço retorna evidências e detecções para revisão. Não considera medidas extraídas da imagem como definitivas. A confirmação humana continua obrigatória para as dimensões críticas do projeto.
