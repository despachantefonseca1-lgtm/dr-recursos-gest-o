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

// Function to draw a simpler, cleaner person icon
// x, y is the top-center of the icon
const drawPersonIcon = (doc: jsPDF, x: number, y: number, withTie: boolean = false) => {
    doc.setFillColor(0, 0, 0);

    // Head: circle, radius 3mm
    doc.circle(x, y + 3, 3, 'F');

    // Body: "tombstone" shape or rounded rect
    // Top-left at x-4, y+7. Width 8, Height 8.
    // We draw a path for a nice shoulder curve
    doc.path([
        { op: 'm', c: [x, y + 6] },
        { op: 'c', c: [x + 5, y + 7, x + 5, y + 14, x + 5, y + 14] }, // Right shoulder/side
        { op: 'l', c: [x - 5, y + 14] }, // Bottom
        { op: 'c', c: [x - 5, y + 14, x - 5, y + 7, x, y + 6] },   // Left shoulder/side (mirrored)
        { op: 'f' }
    ]);

    if (withTie) {
        doc.setFillColor(255, 255, 255);
        // Tie triangle
        doc.triangle(x - 1, y + 7, x + 1, y + 7, x, y + 11, 'F');
        doc.setFillColor(0, 0, 0);
    }
};

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
        // Use absolute path from origin to ensure it works in nested routes
        const bgData = await loadImage(`${window.location.origin}/bg_procuracao.png`);
        doc.addImage(bgData, 'PNG', 0, 0, pageWidth, pageHeight);
    } catch (e: any) {
        console.warn("Could not load background image", e);
        // We don't alert here anymore to allow "silent" fail if needed, or let the caller handle.
        // But user complained about missing BG, so maybe we should throw?
        // No, better to produce a document than nothing.
        // We can draw a fallback header? No, user wants the image.
        // If it fails, it will just be white background.
    }

    // Fonts
    doc.setFont("times", "normal");

    // --- CONTENT ---
    // Adjust starting Y to account for the header in the background image.
    // Assuming header image takes top ~40mm

    const titleY = 40;

    // Title Box
    doc.setDrawColor(0);
    doc.setFillColor(200, 200, 200); // Light grey
    doc.rect(margin, titleY, 60, 8, "F"); // Smaller width
    doc.rect(margin, titleY, 60, 8, "S");

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold");
    doc.text("PROCURAÇÃO", margin + 2, titleY + 5.5);

    doc.setFontSize(11);
    doc.setFont("times", "normal");
    doc.text("JUDICIAL E EXTRA JUDICIAL", margin, titleY + 14);


    // --- ICONS & BOXES ---
    const boxY = titleY + 25; // Adjusted spacing
    const boxHeight = 45; // Compact height
    const colWidth = (contentWidth / 2) - 4;
    const col1X = margin;
    const col2X = pageWidth / 2 + 4; // Right column start

    // Icon Centers
    const iconCenter1 = col1X + 15;
    const iconCenter2 = col2X + 15;

    // Draw Icons "floating" on the top line
    drawPersonIcon(doc, iconCenter1, boxY - 3); // -3 so it sits on the line
    drawPersonIcon(doc, iconCenter2, boxY - 3, true); // Lawyer with tie

    // Draw Boxes
    // Box 1 (Outorgante)
    const gap = 8; // Gap for icon
    doc.line(col1X, boxY, iconCenter1 - gap, boxY);
    doc.line(iconCenter1 + gap, boxY, col1X + colWidth, boxY);
    doc.line(col1X, boxY, col1X, boxY + boxHeight);
    doc.line(col1X + colWidth, boxY, col1X + colWidth, boxY + boxHeight);
    doc.line(col1X, boxY + boxHeight, col1X + colWidth, boxY + boxHeight);

    // Box 2 (Advogado)
    doc.line(col2X, boxY, iconCenter2 - gap, boxY);
    doc.line(iconCenter2 + gap, boxY, col2X + colWidth, boxY);
    doc.line(col2X, boxY, col2X, boxY + boxHeight);
    doc.line(col2X + colWidth, boxY, col2X + colWidth, boxY + boxHeight);
    doc.line(col2X, boxY + boxHeight, col2X + colWidth, boxY + boxHeight);


    // Content Column 1: OUTORGANTE
    let textY = boxY + 8;
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("OUTORGANTE", col1X + 2, textY);

    textY += 5;
    doc.setFont("times", "normal");
    doc.setFontSize(9);

    const outorganteText = `${cliente.nome}, ${cliente.nacionalidade || 'brasileiro(a)'}, ${cliente.estado_civil || 'solteiro(a)'}, ${cliente.profissao || 'autônomo(a)'}, Inscrito CPF N° ${cliente.cpf}, RG N° ${cliente.rg || 'N/I'} SSP MG, Residente E Domiciliado ${cliente.endereco}.`;

    const splitOutorgante = doc.splitTextToSize(outorganteText, colWidth - 4);
    doc.text(splitOutorgante, col1X + 2, textY);


    // Content Column 2: ADVOGADO
    textY = boxY + 8;
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("ADVOGADO", col2X + 2, textY);

    textY += 5;
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    const advogadoText = "Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório na Avenida das Palmeiras, n°512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com";

    const splitAdvogado = doc.splitTextToSize(advogadoText, colWidth - 4);
    doc.text(splitAdvogado, col2X + 2, textY);


    // --- BODY TEXT ---
    let cursorY = boxY + boxHeight + 10; // Tight spacing

    // PODERES GERAIS
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("PODERES GERAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 32, cursorY + 1);

    cursorY += 5;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    // Justified text often looks better but jsPDF 'justify' support is basic.
    const textGerais = "Por este documento particular de mandato, constitui o advogado acima indicada e concede a ele poderes para o foro em geral, com a cláusula ad-judicia, em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-los nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, tudo em conformidade com o dispositivo 105, do CPC.";

    doc.text(textGerais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    const dimGerais = doc.getTextDimensions(textGerais, { maxWidth: contentWidth });
    cursorY += dimGerais.h + 8;

    // PODERES ESPECIAIS
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("PODERES ESPECIAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 38, cursorY + 1);

    cursorY += 5;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const textEspeciais = "Concede também ao advogado constituído poderes especiais para confessar, desistir, transigir, firmar compromissos ou acordos, receber e dar quitação, agindo em conjunto ou separadamente, podendo ainda, substabelecer está em outrem, com ou sem reservas de iguais poderes, dando tudo por bom, firme e valioso para o fiel desempenho do presente mandato.";

    doc.text(textEspeciais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    const dimEspeciais = doc.getTextDimensions(textEspeciais, { maxWidth: contentWidth });
    cursorY += dimEspeciais.h + 20;


    // --- DATE AND SIGNATURE ---
    const today = new Date();
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const dateStr = `Bom Despacho/MG ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

    doc.setFontSize(11);
    doc.text(dateStr, pageWidth / 2, cursorY, { align: "center" });

    cursorY += 20; // Space for signature

    doc.line(margin + 40, cursorY, pageWidth - margin - 40, cursorY);
    doc.text("Outorgante", pageWidth / 2, cursorY + 5, { align: "center" });

    // Save
    const fileName = `Procuracao_${cliente.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
};
