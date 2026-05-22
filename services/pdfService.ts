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

const createPenIconDataUrl = (): string => {
    if (typeof window === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.clearRect(0, 0, 64, 64);
    
    ctx.save();
    // Move origin to the center of the canvas
    ctx.translate(32, 32);
    // Rotate 45 degrees so the pen points down-right (matching the image)
    ctx.rotate(Math.PI / 4);

    // Styling matching the user's reference (black outline, white fill)
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Draw Pen Body (rounded cap on the left, long barrel, pointed tip on the right)
    ctx.beginPath();
    // Semi-circle for the cap end (center at -20, 0, radius 4)
    ctx.arc(-20, 0, 4, Math.PI * 0.5, Math.PI * 1.5, false);
    // Top barrel edge
    ctx.lineTo(18, -4);
    // Pointed tip
    ctx.lineTo(30, 0);
    // Bottom barrel edge
    ctx.lineTo(18, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Separator line between cap and barrel
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-10, 4);
    ctx.stroke();

    // 3. Clip on the cap
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(-18, -8);
    ctx.lineTo(-12, -8);
    ctx.stroke();

    ctx.restore();
    return canvas.toDataURL('image/png');
};

export const generateProcuracaoPDF = async (cliente: RecursoCliente) => {
    // Validate required fields
    if (!cliente.nome || !cliente.cpf) {
        throw new Error('Nome e CPF são obrigatórios para gerar a procuração.');
    }

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
    let bgData: string | null = null;
    try {
        bgData = await loadImage(`${window.location.origin}/bg_procuracao.png`);
    } catch (e: any) {
        console.warn("Could not load background image", e);
    }

    if (bgData) {
        doc.addImage(bgData, 'PNG', 0, 0, pageWidth, pageHeight);
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

    // Build RG - include órgão emissor and UF if available
    let rgText = '';
    if (cliente.rg) {
        let rgCompleto = cliente.rg;
        if (cliente.rg_orgao_emissor || cliente.rg_uf) {
            const orgaoUf = [cliente.rg_orgao_emissor, cliente.rg_uf].filter(Boolean).join('/');
            rgCompleto = `${cliente.rg} ${orgaoUf}`;
        }
        rgText = `, RG N° ${rgCompleto}`;
    }
    
    // Formata o endereço com os novos campos, ou faz fallback para o antigo
    const enderecoCompleto = cliente.logradouro 
        ? `à ${cliente.logradouro}, nº ${cliente.numero}, Bairro ${cliente.bairro}, ${cliente.cidade}-${cliente.uf}, CEP ${cliente.cep}`
        : cliente.endereco || '';

    // Build outorgante text - use ONLY filled data, no defaults
    const outorganteText = `${cliente.nome}, ${cliente.nacionalidade || ''}, ${cliente.estado_civil || ''}, ${cliente.profissao || ''}, Inscrito CPF N° ${cliente.cpf}${rgText}, Residente E Domiciliado ${enderecoCompleto}.`.replace(/, ,/g, ',').replace(/,\s*,/g, ',');

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
    
    // Draw Pen Icon pointing to the signature line
    const penData = createPenIconDataUrl();
    if (penData) {
        // Place it to point directly onto the signature line's starting area.
        // The line starts at x = margin + 40 (60mm) and is at y = cursorY.
        // Bounding box: x = margin + 35 (55mm), y = cursorY - 7, size = 7mm x 7mm.
        // This places the bottom-right tip of the pen icon directly at x = 60.8mm, y = cursorY.
        doc.addImage(penData, 'PNG', margin + 35, cursorY - 7, 7, 7);
    }

    doc.text("Outorgante", pageWidth / 2, cursorY + 5, { align: "center" });


    // Save
    try {
        const fileName = `Procuracao_${cliente.nome.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        doc.save(fileName);
        console.log('PDF gerado com sucesso:', fileName);
    } catch (e: any) {
        console.error('Erro ao salvar PDF:', e);
        throw new Error('Erro ao salvar o arquivo PDF. Verifique as permissões do navegador.');
    }
};
