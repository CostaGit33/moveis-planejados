# AnalitySport

Frontend React/Vite para enviar capturas de estatísticas esportivas ao endpoint OCR.

## Deploy no EasyPanel

Crie um serviço apontando para esta pasta (`analitysport`) e use o Dockerfile localizado em `analitysport/Dockerfile`. O container expõe a porta `3000`. Depois de publicar, aponte `analitysport.novaagencia.online` para o domínio gerado pelo EasyPanel.

O frontend chama, por padrão:

```text
https://opencv.novaagencian8n.online/process-sports-image
```

Para usar outro endereço, configure a variável de build `VITE_SPORTS_API_URL`.

O serviço OCR deve ser publicado separadamente a partir de `vision-ocr/Dockerfile`. O backend precisa estar com a variável `CORS_ORIGINS` incluindo `https://analitysport.novaagencia.online`.
