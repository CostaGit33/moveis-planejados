# POC moveis planejados

Este POC valida a ideia central do arquivo `moveis.txt`: usar um JSON proprio como modelo do projeto e gerar saidas tecnicas a partir dele.

## Executar

```powershell
python .\gerar_poc.py
```

## Entrada

- `projeto_base.json`: ambiente, parede, modulo de armario inferior e materiais.

## Saidas

- `saida_poc/modelo.obj`: modelo 3D simples.
- `saida_poc/modelo.mtl`: materiais do modelo.
- `saida_poc/lista_pecas.csv`: lista inicial de pecas.
- `saida_poc/relatorio.md`: resumo tecnico do resultado.

## Objetivo validado

Gerar automaticamente uma parede e um modulo de armario de `600 x 600 x 720 mm` a partir de JSON, separando o produto principal dos motores externos como Floorplanner, SketchUp e FreeCAD.
