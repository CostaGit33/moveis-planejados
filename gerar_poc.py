import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "projeto_base.json"
OUT = ROOT / "saida_poc"


def box_vertices(x, y, z, w, d, h):
    return [
        (x, y, z),
        (x + w, y, z),
        (x + w, y + d, z),
        (x, y + d, z),
        (x, y, z + h),
        (x + w, y, z + h),
        (x + w, y + d, z + h),
        (x, y + d, z + h),
    ]


def box_faces(offset):
    return [
        (offset + 1, offset + 2, offset + 3, offset + 4),
        (offset + 5, offset + 8, offset + 7, offset + 6),
        (offset + 1, offset + 5, offset + 6, offset + 2),
        (offset + 2, offset + 6, offset + 7, offset + 3),
        (offset + 3, offset + 7, offset + 8, offset + 4),
        (offset + 4, offset + 8, offset + 5, offset + 1),
    ]


def add_box(obj_lines, name, material, x, y, z, w, d, h, vertex_count):
    obj_lines.append(f"o {name}")
    obj_lines.append(f"usemtl {material}")
    for vx, vy, vz in box_vertices(x, y, z, w, d, h):
        obj_lines.append(f"v {vx / 1000:.4f} {vy / 1000:.4f} {vz / 1000:.4f}")
    for face in box_faces(vertex_count):
        obj_lines.append("f " + " ".join(str(i) for i in face))
    return vertex_count + 8


def cabinet_parts(module):
    x = module["x"]
    y = module["y"]
    z = module["z"]
    w = module["largura"]
    d = module["profundidade"]
    h = module["altura"]
    t = module["espessura_chapa"]
    material = module["material"]
    base = module["id"]

    return [
        {"id": f"{base}-LAT-E", "nome": "Lateral esquerda", "x": x, "y": y, "z": z, "largura": t, "profundidade": d, "altura": h, "material": material},
        {"id": f"{base}-LAT-D", "nome": "Lateral direita", "x": x + w - t, "y": y, "z": z, "largura": t, "profundidade": d, "altura": h, "material": material},
        {"id": f"{base}-BASE", "nome": "Base", "x": x, "y": y, "z": z, "largura": w, "profundidade": d, "altura": t, "material": material},
        {"id": f"{base}-TOPO", "nome": "Topo", "x": x, "y": y, "z": z + h - t, "largura": w, "profundidade": d, "altura": t, "material": material},
        {"id": f"{base}-FUNDO", "nome": "Fundo", "x": x, "y": y + d - t, "z": z, "largura": w, "profundidade": t, "altura": h, "material": material},
    ]


def write_mtl(materials):
    lines = []
    for key, material in materials.items():
        r, g, b = material["cor_rgb"]
        lines.extend([f"newmtl {key}", f"Kd {r:.3f} {g:.3f} {b:.3f}", "Ka 0.100 0.100 0.100", ""])
    (OUT / "modelo.mtl").write_text("\n".join(lines), encoding="utf-8")


def write_obj(project, parts):
    lines = ["mtllib modelo.mtl"]
    vertex_count = 0

    for wall in project["paredes"]:
        vertex_count = add_box(
            lines,
            wall["id"],
            wall["material"],
            wall["x"],
            wall["y"],
            wall["z"],
            wall["largura"],
            wall["espessura"],
            wall["altura"],
            vertex_count,
        )

    for part in parts:
        vertex_count = add_box(
            lines,
            part["id"],
            part["material"],
            part["x"],
            part["y"],
            part["z"],
            part["largura"],
            part["profundidade"],
            part["altura"],
            vertex_count,
        )

    (OUT / "modelo.obj").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_bom(parts, unit="mm"):
    with (OUT / "lista_pecas.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["id", "nome", "material", "largura", "profundidade", "altura", "unidade"],
        )
        writer.writeheader()
        for part in parts:
            writer.writerow({
                "id": part["id"],
                "nome": part["nome"],
                "material": part["material"],
                "largura": part["largura"],
                "profundidade": part["profundidade"],
                "altura": part["altura"],
                "unidade": unit,
            })


def write_report(project, parts):
    module = project["modulos"][0]
    lines = [
        "# Resultado do POC",
        "",
        f"Ambiente: {project['ambiente']['nome']}",
        f"Modulo testado: {module['nome']} ({module['largura']} x {module['profundidade']} x {module['altura']} mm)",
        f"Pecas geradas: {len(parts)}",
        "",
        "Arquivos gerados:",
        "- modelo.obj: geometria 3D simples em metros",
        "- modelo.mtl: materiais do modelo",
        "- lista_pecas.csv: BOM inicial para orcamento/corte",
        "",
        "Validacao pratica:",
        "- O JSON central consegue descrever ambiente, parede, modulo e material.",
        "- O gerador consegue transformar um modulo parametrico em pecas individuais.",
        "- O mesmo JSON pode ser adaptado depois para SketchUp Ruby, FreeCAD Python ou FML/Floorplanner.",
    ]
    (OUT / "relatorio.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    project = json.loads(INPUT.read_text(encoding="utf-8"))
    OUT.mkdir(exist_ok=True)
    parts = []
    for module in project["modulos"]:
        if module["tipo"] == "armario_inferior":
            parts.extend(cabinet_parts(module))
        else:
            raise ValueError(f"Tipo de modulo nao suportado: {module['tipo']}")

    write_mtl(project["materiais"])
    write_obj(project, parts)
    write_bom(parts, project["unidade"])
    write_report(project, parts)
    print(f"POC gerado em: {OUT}")
    print("Arquivos: modelo.obj, modelo.mtl, lista_pecas.csv, relatorio.md")


if __name__ == "__main__":
    main()
