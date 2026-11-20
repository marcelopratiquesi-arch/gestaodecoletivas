# Regras do sistema (Gestão Prática)

## Padrão de modal / pop-up (REGRA DO SISTEMA)

Quando o usuário disser "modal", "pop-up" ou "janela", ou pedir para criar qualquer janela que abre sobre a tela, use SEMPRE o componente `src/components/PopupFlutuante.jsx`. Não crie overlay próprio (`fixed inset-0 ... bg-black/50`).

**Como ele se comporta (não mude por tela):**
- Flutuante, sem fundo escuro e sem travar a página: a tela de trás continua visível e clicável.
- Arrastável pela barra de título; redimensionável pelo canto inferior direito.
- Esc fecha. Também fecha pelo X e pelo botão Cancelar.
- Dentro da janela da tela: nunca passa da borda do navegador (margem de 8 px).
- Lembra tamanho e posição no navegador (`localStorage`), por `chaveMemoria`.
- No celular (largura menor que 768 px) vira tela cheia, sem arrastar nem redimensionar.
- Quem está salvando não pode fechar: use `bloquearFechar={salvando}`.

**Visual (cores do sistema: vermelho, cinza, branco, preto):**
- Barra de título vermelha com letra branca; fundo cinza claro; faixa de ações branca.
- Todo o texto dentro dele em MAIÚSCULAS (já vem da classe `uppercase` do componente; use `normal-case` só onde for texto de ajuda longo ou e-mail/senha).
- Botão principal (Salvar/Concluir) vermelho; Cancelar cinza. Campos com borda cinza e foco vermelho.
- NÃO usar azul no pop-up.

**Estrutura:**
- Os botões de ação (Cancelar / Salvar / Excluir) vão na prop `rodape`, que aparece LOGO ABAIXO do título (sempre visível, sem rolar). Se o formulário tem `<form>`, dê um `id` e use `<button type="submit" form="id-do-form">` no rodapé.
- O conteúdo (campos, avisos) vai em `children`; só essa área rola.
- Cada pop-up precisa de uma `chaveMemoria` única (ex.: `mentores.popupMentor`). Ao mudar o tamanho/posição padrão, mude a chave (ex.: sufixo `.v2`) para ninguém ficar com a posição antiga.
- Props: `titulo`, `onFechar`, `children`, `rodape`, `chaveMemoria`, `bloquearFechar`, `largura`, `altura`, `larguraMinima`, `alturaMinima`, `rotuloFechar`.
- Confirmações pequenas ("tem certeza?") podem continuar simples; não precisa virar janela arrastável.

**Campos dentro do pop-up (visual exato do Cronograma, não inventar outro):**
- Rótulo: `text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5 block`.
- Campo/select: `w-full p-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-xl text-sm font-bold uppercase outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100`. Nunca fundo cinza apagado nem borda transparente.
- Seções separadas por linha fina cinza, título da seção em vermelho (`text-[11px] font-black uppercase tracking-widest text-red-600`).
- Responsivo: mesma coluna única no computador e no celular; campos curtos (datas, país/status) podem ficar 2 por linha (`grid grid-cols-2 gap-3`).

**Documento e país (REGRA):** o documento acompanha o país escolhido (Brasil → CPF, Argentina → DNI, Estados Unidos → SSN; helper `tipoDocumentoDoPais` em `src/utils/documento.js`). O campo mostra SÓ o documento do país; não mostrar os 3 botões CPF/DNI/SSN. Se a pessoa tiver outro, ela clica em "Meu documento é outro" e aí escolhe o tipo. Usar `CampoDocumento` com `tipoDoPais={tipoDocumentoDoPais(pais)}` e `key={pais}`. Telefone e documento seguem o mesmo país.

Exemplos prontos: Cronograma > Criar/Editar aula (`src/app/Cronograma/index.jsx`) e Configurações > Mentores (`MentoresTab.jsx`, `SegundoMentorModal.jsx`, `UnidadesVinculadasModal.jsx`).

## Grade do Cronograma no celular
No celular a grade vira uma lista de um dia por vez, abrindo no dia de hoje, com uma barra para trocar de dia. No computador continua a grade semanal.

## Paleta de cores do sistema (REGRA DO SISTEMA)

O sistema é **vermelho, preto, cinza e branco**. Nada de cor decorativa por aba ou por tela.

- **Marca/ação:** vermelho (`red-600` / `red-700`): botão principal, item ativo, foco, títulos de seção.
- **Neutros:** `slate` (único cinza permitido; não usar `gray`, `zinc`, `neutral`, `stone`), branco e preto.
- **Status (e só para status):** verde = ok/ativo/positivo (`emerald`, único verde; não usar `green`), amarelo/âmbar = atenção/pendente (`amber`), vermelho = erro/negativo/excluir (`red`; não usar `rose`).
- **Proibido como enfeite:** azul, roxo, violeta, índigo, teal, ciano, sky, laranja, rosa, fúcsia, lima. Ex.: não existe "cor da aba".
- **Exceções permitidas:** gráficos (várias cores para separar séries) e cores que o usuário escolhe no cadastro (modalidades, bandeiras de país).
- **Telas públicas, login e PratiquePlay/player:** também seguem a paleta, mas entram por último na padronização.
- Antes de usar uma cor nova, pergunte ao usuário.
