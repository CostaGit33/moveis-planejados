# Resultado do POC

Ambiente: POC cozinha linear
Modulo testado: Armario inferior 600 (600 x 600 x 720 mm)
Pecas geradas: 5

Arquivos gerados:
- modelo.obj: geometria 3D simples em metros
- modelo.mtl: materiais do modelo
- lista_pecas.csv: BOM inicial para orcamento/corte

Validacao pratica:
- O JSON central consegue descrever ambiente, parede, modulo e material.
- O gerador consegue transformar um modulo parametrico em pecas individuais.
- O mesmo JSON pode ser adaptado depois para SketchUp Ruby, FreeCAD Python ou FML/Floorplanner.
