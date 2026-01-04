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
            if (!ctx) return reject('Canvas error');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject('Failed to load image');
    });
}

// Function to draw a simple "person" icon
const drawPersonIcon = (doc: jsPDF, x: number, y: number, withTie: boolean = false) => {
    doc.setFillColor(0, 0, 0);
    // Head
    doc.circle(x, y, 4, 'F');
    // Body (Rounded Rect mostly)
    // Draw a half-circle/arch for shoulders
    doc.path([
        { op: 'm', c: [x - 6, y + 5] },
        { op: 'c', c: [x - 6, y + 10, x + 6, y + 10, x + 6, y + 5] }, // bottom curve
        { op: 'c', c: [x + 6, y + 5, x + 5, y - 2, x, y - 2] }, // top right shoulder
        { op: 'c', c: [x - 5, y - 2, x - 6, y + 5, x - 6, y + 5] }, // top left
    ]);
    // Simplified body:
    // Shoulder start
    doc.path([
        { op: 'm', c: [x, y + 5] }, // neck center
        { op: 'l', c: [x - 5, y + 7] }, // left shoulder out
        { op: 'c', c: [x - 7, y + 9, x - 7, y + 16, x - 5, y + 18] }, // left side down curved
        { op: 'l', c: [x + 5, y + 18] }, // bottom
        { op: 'c', c: [x + 7, y + 16, x + 7, y + 9, x + 5, y + 7] }, // right side up curved
        { op: 'l', c: [x, y + 5] }, // neck center
        { op: 'f' } // fill
    ]);

    if (withTie) {
        doc.setFillColor(255, 255, 255); // White tie
        // Simple triangle tie
        doc.triangle(x - 1.5, y + 7, x + 1.5, y + 7, x, y + 12, 'F');
        doc.setFillColor(0, 0, 0); // Restore black
    }
};

export const generateProcuracaoPDF = async (cliente: RecursoCliente) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Load Background
    try {
        const bgData = await loadImage('/bg_procuracao.png');
        doc.addImage(bgData, 'PNG', 0, 0, pageWidth, pageHeight);
    } catch (e) {
        console.warn("Could not load background image", e);
        // Fallback: draw minimal header if image fails ? Or just proceed without bg
    }

    // Fonts
    doc.setFont("times", "normal");

    // --- CONTENT ---
    // We assume the background image contains the Header (Logo/Text) and Footer.
    // So we start content below the header area.
    // Adjust Y based on the provided image layout.
    // The layout image shows header taking up top ~40mm.

    // Title Box
    const titleY = 45;
    doc.setDrawColor(0);
    doc.setFillColor(180, 180, 180);
    doc.rect(margin, titleY, 80, 8, "F");
    doc.rect(margin, titleY, 80, 8, "S");

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold");
    doc.text("PROCURAÇÃO", margin + 2, titleY + 5.5);

    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text("JUDICIAL E EXTRA JUDICIAL", margin, titleY + 16);


    // --- ICONS & BOXES ---
    const boxY = titleY + 35;
    const boxHeight = 50; // Reduced height
    const colWidth = (contentWidth / 2) - 5;
    const col1X = margin;
    const col2X = pageWidth / 2 + 5;

    // Draw Icons "floating" on top border of boxes
    // Outorgante Icon (Client)
    drawPersonIcon(doc, col1X + 20, boxY); // Center on line? boxY is top line

    // Advogado Icon (Lawyer with Tie)
    drawPersonIcon(doc, col2X + 20, boxY, true);


    // Draw Boxes boundaries (leaving gap for icons)
    // Box 1
    const iconGap = 15;
    const iconCenter1 = col1X + 20;
    doc.line(col1X, boxY, iconCenter1 - 8, boxY);
    doc.line(iconCenter1 + 8, boxY, col1X + colWidth, boxY);
    doc.line(col1X, boxY, col1X, boxY + boxHeight);
    doc.line(col1X + colWidth, boxY, col1X + colWidth, boxY + boxHeight);
    doc.line(col1X, boxY + boxHeight, col1X + colWidth, boxY + boxHeight);

    // Box 2
    const iconCenter2 = col2X + 20;
    doc.line(col2X, boxY, iconCenter2 - 8, boxY);
    doc.line(iconCenter2 + 8, boxY, col2X + colWidth, boxY);
    doc.line(col2X, boxY, col2X, boxY + boxHeight);
    doc.line(col2X + colWidth, boxY, col2X + colWidth, boxY + boxHeight);
    doc.line(col2X, boxY + boxHeight, col2X + colWidth, boxY + boxHeight);


    // Content Column 1: OUTORGANTE
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("OUTORGANTE", col1X + 2, boxY + 12);

    doc.setFont("times", "normal");
    doc.setFontSize(9);

    const outorganteText = `${cliente.nome}, ${cliente.nacionalidade || 'brasileiro(a)'}, ${cliente.estado_civil || 'solteiro(a)'}, ${cliente.profissao || 'autônomo(a)'}, Inscrito CPF N° ${cliente.cpf}, RG N° ${cliente.rg || 'N/I'} SSP MG, Residente E Domiciliado ${cliente.endereco}.`;

    const splitOutorgante = doc.splitTextToSize(outorganteText, colWidth - 4);
    doc.text(splitOutorgante, col1X + 2, boxY + 18);


    // Content Column 2: ADVOGADO
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("ADVOGADO", col2X + 2, boxY + 12);

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    const advogadoText = "Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório na Avenida das Palmeiras, n°512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com";

    const splitAdvogado = doc.splitTextToSize(advogadoText, colWidth - 4);
    doc.text(splitAdvogado, col2X + 2, boxY + 18);


    // --- BODY TEXT ---
    let cursorY = boxY + boxHeight + 12; // Tighter spacing

    // PODERES GERAIS
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("PODERES GERAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 35, cursorY + 1);

    cursorY += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const textGerais = "Por este documento particular de mandato, constitui o advogado acima indicada e concede a ele poderes para o foro em geral, com a cláusula ad-judicia, em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-los nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, tudo em conformidade com o dispositivo 105, do CPC.";

    doc.text(textGerais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    const dimGerais = doc.getTextDimensions(textGerais, { maxWidth: contentWidth });
    cursorY += dimGerais.h + 8;

    // PODERES ESPECIAIS
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("PODERES ESPECIAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 40, cursorY + 1);

    cursorY += 6;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const textEspeciais = "Concede também ao advogado constituído poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, agindo em conjunto ou separadamente, podendo ainda, substabelecer está em outrem, com ou sem reservas de iguais poderes, dando tudo por bom, firme e valioso para o fiel desempenho do presente mandato.";

    doc.text(textEspeciais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    const dimEspeciais = doc.getTextDimensions(textEspeciais, { maxWidth: contentWidth });
    cursorY += dimEspeciais.h + 15;


    // --- DATE AND SIGNATURE ---
    const today = new Date();
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dateStr = `Bom Despacho/MG ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

    doc.setFontSize(11);
    doc.text(dateStr, pageWidth / 2, cursorY, { align: "center" });

    cursorY += 25; // Space for signature

    doc.line(margin + 40, cursorY, pageWidth - margin - 40, cursorY);
    doc.text("Outorgante", pageWidth / 2, cursorY + 5, { align: "center" });

    // (Footer is in background image)

    // Save
    const fileName = `Procuracao_${cliente.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
};
