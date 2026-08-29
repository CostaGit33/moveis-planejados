# Moveis Planejados Vision OCR

API de visão computacional para interpretar fotos e rascunhos técnicos de móveis planejados.

## Versão

`3.0.0`

## Objetivo

Transformar uma imagem de rascunho em **evidências estruturadas**, sem tratar OCR isolado como medida definitiva para fabricação.

### Pipeline

```text
Imagem
  ↓
EXIF / validação
  ↓
OpenCV: grayscale + denoise + CLAHE + threshold + morphology
  ↓
Tesseract: múltiplas variantes + PSM 11/6
  ↓
Normalização de números/unidades
  ↓
Deduplicação espacial
  ↓
Detecção de linhas Hough
  ↓
Pontuação de candidatos
  ↓
JSON de evidências
  ↓
Vision Model / revisão humana
  ↓
Medidas validadas
```

## Endpoints

- `GET /` — informações do serviço e capacidades.
- `GET /health` — status, OpenCV, Tesseract e idiomas.
- `POST /process-image` — recebe `multipart/form-data` no campo `image`.
- `GET /docs` — Swagger/OpenAPI automático.

## Melhorias da V3

- coordenadas das caixas sempre convertidas para a imagem original;
- OCR em 4 variantes de pré-processamento e 2 configurações de layout;
- suporte a `mm`, `cm` e `m`, com normalização para milímetros;
- deduplicação espacial dos mesmos números encontrados em múltiplas passagens;
- `evidence_hits` para indicar repetição da evidência;
- detecção de linhas horizontais, verticais e diagonais via Hough;
- classificação em `high_confidence_candidate`, `probable_dimension`, `weak_dimension_candidate` e `low_confidence_noise`;
- razões de confiança explicáveis;
- limite de upload configurável por `MAX_IMAGE_MB`;
- limite de resolução configurável por `MAX_IMAGE_DIMENSION`;
- gate de segurança: nenhuma medida é automaticamente considerada pronta para fabricação.

## Exemplo de candidato

```json
{
  "value": 875,
  "value_mm": 875,
  "unit": "unknown",
  "status": "probable_dimension",
  "dimension_confidence": 0.74,
  "evidence_hits": 3,
  "requires_confirmation": true
}
```

`unknown` é intencional: quando o desenho não informa unidade, a API não deve inventá-la.

## EasyPanel / Docker

O `Dockerfile` expõe a porta documental `8000`, mas inicia o Uvicorn usando automaticamente a variável `PORT` fornecida pelo ambiente:

```text
--port ${PORT:-8000}
```

Assim, se o EasyPanel fornecer `PORT=80`, a aplicação escuta em `0.0.0.0:80`. Em ambientes locais sem `PORT`, usa `8000`.

## Produção

O resultado de `/process-image` deve alimentar a próxima camada de visão multimodal. O campo `critical_dimensions_confirmed` permanece falso por padrão: OCR é evidência, não instrumento de medição.
