import React from 'react';
import { createPortal } from 'react-dom';
import PopupFlutuante from '../../components/PopupFlutuante';

/**
 * Janela padrão da aba Workshops: o pop-up padrão do sistema (PopupFlutuante): flutuante, arrastável, sem fundo escuro,
 * botões logo abaixo do título. Vai para o <body> (portal) para não ser afetada pelas animações da tela.
 */
export default function ModalWorkshop({ titulo, largo, onClose, children, rodape }) {
  return createPortal(
    <PopupFlutuante
      titulo={titulo} onFechar={onClose} rodape={rodape}
      chaveMemoria={`workshops.janela.${largo ? 'larga' : 'normal'}.v1`}
      largura={largo ? 980 : 560} altura={largo ? 720 : 640} larguraMinima={420} alturaMinima={360}
    >
      <div className="p-5 space-y-4">{children}</div>
    </PopupFlutuante>,
    document.body,
  );
}
