# orcamentos_ia_extension.rb - extensão Ruby stub para integrar com o sistema de orçamentos
# Funções mínimas para receber JSON do Agent IA e criar/atualizar objetos no SketchUp

module OrcamentosIA
  def self.receber_json_e_criar(json)
    puts "Recebendo JSON de orcamento: #{json}"
    # Parse e converte para comandos do ArmarioBuilder
    # Exemplo: ArmarioBuilder.criar_armario({ largura: 600, altura: 720, profundidade: 560, portas: 2 })
    true
  end
end

# Integração com menu do SketchUp (exemplo):
# UI.menu('Extensions').add_item('Orçamentos IA') { OrcamentosIA.receber_json_e_criar('{}') }
