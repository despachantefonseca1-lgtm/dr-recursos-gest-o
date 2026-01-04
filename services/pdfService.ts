import jsPDF from 'jspdf';
import { RecursoCliente } from '../types';

const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas error'));
            ctx.drawImage(img, 0, 0);
            try {
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = (e) => reject(new Error('Failed to load image: ' + url));
    });
}

export const generateProcuracaoPDF = async (cliente: RecursoCliente) => {
    // Initialize with 'mm' units and A4 format
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // ~210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // ~297mm
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Load Background
    try {
        const bgData = await loadImage(`${window.location.origin}/bg_procuracao.png`);
        doc.addImage(bgData, 'PNG', 0, 0, pageWidth, pageHeight);
    } catch (e: any) {
        console.warn("Could not load background image", e);
    }

    // Fonts
    doc.setFont("times", "normal");

    // --- CONTENT ---
    // Moved down as requested
    const titleY = 50;

    // Title Box
    doc.setDrawColor(0);
    doc.setFillColor(200, 200, 200); // Light grey
    doc.rect(margin, titleY, 60, 8, "F");
    doc.rect(margin, titleY, 60, 8, "S");

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold");
    doc.text("PROCURAÇÃO", margin + 2, titleY + 5.5);

    doc.setFontSize(11);
    doc.setFont("times", "normal");
    doc.text("JUDICIAL E EXTRA JUDICIAL", margin, titleY + 14);


    // --- BOXES ---
    const boxY = titleY + 25;
    const boxHeight = 50; // Slightly taller for better spacing inside
    const colWidth = (contentWidth / 2) - 4;
    const col1X = margin;
    const col2X = pageWidth / 2 + 4;

    // Draw Boxes (Simple rectangles now)
    // Box 1 (Outorgante)
    doc.rect(col1X, boxY, colWidth, boxHeight);

    // Box 2 (Advogado)
    doc.rect(col2X, boxY, colWidth, boxHeight);


    // Content Column 1: OUTORGANTE
    let textY = boxY + 10;
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("OUTORGANTE", col1X + 4, textY);

    textY += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10); // Slightly larger font for readability

    const outorganteText = `${cliente.nome}, ${cliente.nacionalidade || 'brasileiro(a)'}, ${cliente.estado_civil || 'solteiro(a)'}, ${cliente.profissao || 'autônomo(a)'}, Inscrito CPF N° ${cliente.cpf}, RG N° ${cliente.rg || 'N/I'} SSP MG, Residente E Domiciliado ${cliente.endereco}.`;

    const splitOutorgante = doc.splitTextToSize(outorganteText, colWidth - 8);
    doc.text(splitOutorgante, col1X + 4, textY);


    // Content Column 2: ADVOGADO
    textY = boxY + 10;
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("ADVOGADO", col2X + 4, textY);

    textY += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const advogadoText = "Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório na Avenida das Palmeiras, n°512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com";

    const splitAdvogado = doc.splitTextToSize(advogadoText, colWidth - 8);
    doc.text(splitAdvogado, col2X + 4, textY);


    // --- BODY TEXT ---
    // Adjusted for new box height and position
    let cursorY = boxY + boxHeight + 15;

    // PODERES GERAIS
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("PODERES GERAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 35, cursorY + 1);

    cursorY += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10.5); // Slightly larger

    const textGerais = "Por este documento particular de mandato, constitui o advogado acima indicada e concede a ele poderes para o foro em geral, com a cláusula ad-judicia, em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-los nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, tudo em conformidade com o dispositivo 105, do CPC.";

    doc.text(textGerais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    const dimGerais = doc.getTextDimensions(textGerais, { maxWidth: contentWidth });
    cursorY += dimGerais.h + 10;

    // PODERES ESPECIAIS
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("PODERES ESPECIAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 40, cursorY + 1);

    cursorY += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10.5);
    const textEspeciais = "Concede também ao advogado constituído poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, agindo em conjunto ou separadamente, podendo ainda, substabelecer está em outrem, com ou sem reservas de iguais poderes, dando tudo por bom, firme e valioso para o fiel desempenho do presente mandato.";

    doc.text(textEspeciais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    const dimEspeciais = doc.getTextDimensions(textEspeciais, { maxWidth: contentWidth });
    cursorY += dimEspeciais.h + 25; // More space before signature


    // --- DATE AND SIGNATURE ---
    const today = new Date();
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dateStr = `Bom Despacho/MG ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

    doc.setFontSize(11);
    doc.text(dateStr, pageWidth / 2, cursorY, { align: "center" });

    cursorY += 25;

    doc.line(margin + 40, cursorY, pageWidth - margin - 40, cursorY);
    doc.text("Outorgante", pageWidth / 2, cursorY + 5, { align: "center" });


    // Save
    const fileName = `Procuracao_${cliente.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
};
