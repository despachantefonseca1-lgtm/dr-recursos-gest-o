import jsPDF from 'jspdf';
import { RecursoCliente } from '../types';

export const generateProcuracaoPDF = (cliente: RecursoCliente) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Fonts
    doc.setFont("times", "normal");

    // --- HEADER ---
    // Logo placeholder text (since we don't have the image file)
    doc.setFontSize(24);
    doc.setTextColor(80, 80, 80);
    doc.text("ISRAEL FONSECA", pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setCharSpace(3);
    doc.text("ADVOGADO", pageWidth / 2, 26, { align: "center" });
    doc.setCharSpace(0);

    // Title Box
    doc.setDrawColor(0);
    doc.setFillColor(180, 180, 180); // Grey background
    doc.rect(margin, 35, 80, 8, "F"); // Background
    doc.rect(margin, 35, 80, 8, "S"); // Border

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont("times", "bold");
    doc.text("PROCURAÇÃO", margin + 2, 40);

    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text("JUDICIAL E EXTRA JUDICIAL", margin, 50);


    // --- ICONS (Placeholder circles) ---
    // Outorgante Icon
    doc.setFillColor(0, 0, 0);
    doc.circle(margin + 20, 65, 4, "F");
    doc.circle(margin + 20, 71, 6, "F");

    // Advogado Icon
    doc.circle(pageWidth / 2 + 20, 65, 4, "F");
    doc.circle(pageWidth / 2 + 20, 71, 6, "F");


    // --- COLUMNS ---
    const colWidth = (contentWidth / 2) - 5;
    const col1X = margin;
    const col2X = pageWidth / 2 + 5;
    const boxY = 75;
    const boxHeight = 55;

    // Box lines
    // Outorgante Box
    doc.line(col1X, boxY, col1X + 10, boxY); // Top left
    doc.line(col1X + 30, boxY, col1X + colWidth, boxY); // Top right (gap for icon)
    doc.line(col1X, boxY, col1X, boxY + boxHeight); // Left
    doc.line(col1X + colWidth, boxY, col1X + colWidth, boxY + boxHeight); // Right
    doc.line(col1X, boxY + boxHeight, col1X + colWidth, boxY + boxHeight); // Bottom

    // Advogado Box
    doc.line(col2X, boxY, col2X + 10, boxY);
    doc.line(col2X + 30, boxY, col2X + colWidth, boxY);
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
    doc.text(splitOutorgante, col1X + 2, boxY + 20);


    // Content Column 2: ADVOGADO
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text("ADVOGADO", col2X + 2, boxY + 12);

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    const advogadoText = "Israel Fonseca, brasileiro, casado, advogado, inscrito na OAB/MG sob n° 214.437, com escritório na Avenida das Palmeiras, n°512, Centro, Bom Despacho/MG, CEP 35630-002, endereço eletrônico ifadvogado214437@gmail.com";

    const splitAdvogado = doc.splitTextToSize(advogadoText, colWidth - 4);
    doc.text(splitAdvogado, col2X + 2, boxY + 20);


    // --- BODY TEXT ---
    let cursorY = boxY + boxHeight + 15;

    // PODERES GERAIS
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("PODERES GERAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 40, cursorY + 1); // Underline style

    cursorY += 8;
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    const textGerais = "Por este documento particular de mandato, constitui o advogado acima indicada e concede a ele poderes para o foro em geral, com a cláusula ad-judicia, em qualquer Juízo, Instância ou Tribunal, podendo propor contra quem de direito as ações competentes e defendê-los nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, tudo em conformidade com o dispositivo 105, do CPC.";

    doc.text(textGerais, margin, cursorY, { maxWidth: contentWidth, align: "justify" });

    // Estimate height of previous block
    const dimGerais = doc.getTextDimensions(textGerais, { maxWidth: contentWidth });
    cursorY += dimGerais.h + 10;

    // PODERES ESPECIAIS
    doc.setFontSize(11);
    doc.setFont("times", "bold");
    doc.text("PODERES ESPECIAIS", margin, cursorY);
    doc.line(margin, cursorY + 1, margin + 45, cursorY + 1);

    cursorY += 8;
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

    cursorY += 30; // Space for signature

    // Pen Icon placeholder line
    // doc.addImage(...) if we had one.

    doc.line(margin + 40, cursorY, pageWidth - margin - 40, cursorY);
    doc.text("Outorgante", pageWidth / 2, cursorY + 5, { align: "center" });


    // --- FOOTER ---
    const footerY = pageHeight - 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 20, footerY - 5, pageWidth - margin - 20, footerY - 5);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("(37) 99968-4865   |   ifadvogado214437@gmail.com", pageWidth / 2, footerY, { align: "center" });
    doc.text("Av. das Palmeiras, 512 - Centro", pageWidth / 2, footerY + 3, { align: "center" });
    doc.text("Bom Despacho/MG, CEP 35.630-001", pageWidth / 2, footerY + 6, { align: "center" });


    // Save
    const fileName = `Procuracao_${cliente.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    doc.save(fileName);
};
