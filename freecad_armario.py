# freecad_armario.py
# Script FreeCAD (Python) para criar um módulo/armário paramétrico e exportar uma cutlist básica
# Use dentro do FreeCAD (macro) ou via freecadcmd

from __future__ import annotations
import json
import os

# Exemplo de spec JSON
# spec = { 'nome': 'Modulo A', 'largura':600, 'altura':720, 'profundidade':560, 'portas':2, 'prateleiras':3, 'material':'MDF', 'espessura':18 }

def generate_parts_from_spec(spec):
    esp = float(spec.get('espessura', 18))
    largura = float(spec['largura'])
    altura = float(spec['altura'])
    profundidade = float(spec['profundidade'])

    parts = []
    parts.append({'nome':'Painel Traseiro', 'largura': largura, 'altura': altura - esp, 'espessura': esp, 'quantidade':1})
    parts.append({'nome':'Lateral', 'largura': profundidade - esp, 'altura': altura, 'espessura': esp, 'quantidade':2})
    parts.append({'nome':'Tampo', 'largura': largura, 'profundidade': profundidade, 'espessura': esp, 'quantidade':1})
    parts.append({'nome':'Base', 'largura': largura, 'profundidade': profundidade, 'espessura': esp, 'quantidade':1})
    prateleiras = int(spec.get('prateleiras', 0))
    if prateleiras>0:
        parts.append({'nome':'Prateleira','largura': largura - (esp*2),'profundidade': profundidade - esp,'espessura':esp,'quantidade':prateleiras})
    portas = int(spec.get('portas',0))
    if portas>0:
        portaLarg = (largura / portas) - (esp * 0.5)
        parts.append({'nome':'Porta','largura': portaLarg,'altura': altura - esp*2,'espessura':esp,'quantidade':portas})
    return parts

def export_cutlist_csv(parts, out_path):
    header = 'nome,largura,altura,profundidade,espessura,quantidade\n'
    lines = []
    for p in parts:
        largura = p.get('largura','')
        altura = p.get('altura','')
        profundidade = p.get('profundidade','')
        lines.append(f"{p.get('nome')},{largura},{altura},{profundidade},{p.get('espessura','')},{p.get('quantidade',1)}")
    with open(out_path,'w',encoding='utf8') as f:
        f.write(header + '\n'.join(lines))
    return out_path

if __name__=='__main__':
    import sys
    # leitura do JSON via arquivo ou stdin
    if len(sys.argv) < 2:
        print('Uso: freecad_armario.py spec.json [out.csv]')
        sys.exit(1)
    spec_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(spec_path)[0] + '_cutlist.csv'
    spec = json.load(open(spec_path,'r',encoding='utf8'))
    parts = generate_parts_from_spec(spec)
    export_cutlist_csv(parts, out_path)
    print('Cutlist gerada em', out_path)
