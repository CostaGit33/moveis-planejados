# armario_builder.rb - SketchUp Ruby extension stub
# Este é um esqueleto para uma extensão que recebe JSON e cria um armário paramétrico
# Para usar de verdade, coloque este script como um plugin no SketchUp (Plugins/ or Extensions)

module ArmarioBuilder
  # Gera um módulo/armário paramétrico mínimo no SketchUp
  # params (Hash simbólico): { largura: 600, altura: 720, profundidade: 560, portas: 2, prateleiras: 3, espessura: 18 }
  def self.criar_armario(params)
    puts "Criando armário com params: #{params}"
    begin
      model = Sketchup.active_model
      entities = model.active_entities

      largura = params[:largura].to_f
      altura = params[:altura].to_f
      profundidade = params[:profundidade].to_f
      esp = params[:espessura] ? params[:espessura].to_f : 18.0

      # Criar grupo principal
      group = entities.add_group
      gents = group.entities

      # Criar corpo (caixa)
      pt1 = Geom::Point3d.new(0, 0, 0)
      pt2 = Geom::Point3d.new(largura.mm, 0, 0)
      pt3 = Geom::Point3d.new(largura.mm, profundidade.mm, 0)
      pt4 = Geom::Point3d.new(0, profundidade.mm, 0)

      face = gents.add_face(pt1, pt2, pt3, pt4)
      face.reverse! if face.normal.z < 0
      face.pushpull(-altura.mm)

      # Converter mm (helper)
      # Obs: no SketchUp, unidades dependem do template. Usamos helpers de conversão:
      def self.mm(v)
        v.to_f / 25.4 # SketchUp usa polegadas internamente; este é um placeholder simplificado
      end

      # Porta(s) simples: criar planos frontais recortados (apenas representação)
      portas = params[:portas].to_i
      if portas > 0
        porta_larg = largura / portas
        portas.times do |i|
          x0 = i * porta_larg
          x1 = x0 + porta_larg
          # criar retângulo de porta (apenas face na frente)
          p1 = Geom::Point3d.new(x0.mm, 0, esp.mm)
          p2 = Geom::Point3d.new(x1.mm, 0, esp.mm)
          p3 = Geom::Point3d.new(x1.mm, 0, altura.mm - esp.mm)
          p4 = Geom::Point3d.new(x0.mm, 0, altura.mm - esp.mm)
          gents.add_face(p1, p2, p3, p4)
        end
      end

      return true
    rescue Exception => e
      puts "Erro ao criar armário no SketchUp: #{e}"
      return false
    end
  end
end

# Teste rápido (rodar dentro do SketchUp console)
if __FILE__ == $0
  sample = { largura: 600, altura: 720, profundidade: 560, portas: 2, prateleiras: 3, espessura: 18 }
  puts ArmarioBuilder.criar_armario(sample)
end

# Se rodar diretamente, teste rápido
if __FILE__ == $0
  sample = { largura: 600, altura: 720, profundidade: 560, portas: 2, prateleiras: 3, material: 'MDF Branco' }
  puts ArmarioBuilder.criar_armario(sample)
end
