import React, { useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Column {
    header: string;
    dataKey: string;
}

interface ReportPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    columns: Column[];
    data: any[];
    fileName?: string;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    columns,
    data,
    fileName = 'relatorio'
}) => {
    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF({
            orientation: columns.length > 4 ? 'landscape' : 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Add title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 14, 15);

        // Add subtitle if exists
        if (subtitle) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitle, 14, 22);
        }

        // Add table
        autoTable(doc, {
            startY: subtitle ? 28 : 22,
            head: [columns.map(col => col.header)],
            body: data.map(row => columns.map(col => row[col.dataKey] || '-')),
            styles: {
                fontSize: 8,
                cellPadding: 2,
            },
            headStyles: {
                fillColor: [99, 102, 241], // indigo-600
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252], // slate-50
            },
            margin: { top: 10, right: 10, bottom: 10, left: 10 },
        });

        // Add footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(
                `Página ${i} de ${pageCount} - Gerado em ${new Date().toLocaleString('pt-BR')}`,
                14,
                doc.internal.pageSize.height - 10
            );
        }

        doc.save(`${fileName}.pdf`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-4">
                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                    <p className="text-xs font-bold text-indigo-700 mb-1">📊 Preview do Relatório</p>
                    <p className="text-xs text-slate-600">
                        {data.length} registro{data.length !== 1 ? 's' : ''} encontrado{data.length !== 1 ? 's' : ''}.
                        Você pode imprimir ou baixar em PDF.
                    </p>
                </div>

                {subtitle && (
                    <p className="text-sm text-slate-600 font-medium">{subtitle}</p>
                )}

                {/* Preview Table */}
                <div className="max-h-96 overflow-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs">
                        <thead className="bg-indigo-600 text-white sticky top-0">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className="px-3 py-2 text-left font-bold uppercase">
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.length > 0 ? (
                                data.map((row, idx) => (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        {columns.map((col, colIdx) => (
                                            <td key={colIdx} className="px-3 py-2 text-slate-700">
                                                {row[col.dataKey] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400">
                                        Nenhum registro para exibir
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={onClose}>
                        Fechar
                    </Button>
                    <Button variant="outline" onClick={handlePrint} icon="🖨️">
                        Imprimir
                    </Button>
                    <Button variant="primary" onClick={handleDownloadPDF} icon="📥">
                        Baixar PDF
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
