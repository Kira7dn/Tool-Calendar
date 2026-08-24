/* eslint-disable */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  HeadingLevel,
} from 'docx'
import { saveAs } from 'file-saver'

export const exportToWord = (data, month, year) => {
  // Create table rows
  const tableRows = [
    // Header Row 1
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'STT', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          rowSpan: 2,
          verticalAlign: 'center',
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Đơn vị / Phòng ban', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          rowSpan: 2,
          verticalAlign: 'center',
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Tổng nhận', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          rowSpan: 2,
          verticalAlign: 'center',
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Đã xử lý', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          columnSpan: 2,
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Đang giải quyết', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          columnSpan: 2,
        }),
      ],
    }),
    // Header Row 2
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Đúng hạn', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Quá hạn', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Trong hạn', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Quá hạn', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      ],
    }),
  ]

  // Data Rows
  let totalReceived = 0
  let totalOnTime = 0
  let totalOverdue = 0
  let totalProcOnTime = 0
  let totalProcOverdue = 0

  data.forEach((row, index) => {
    totalReceived += row.total
    totalOnTime += row.onTime
    totalOverdue += row.overdue
    totalProcOnTime += row.processingOnTime
    totalProcOverdue += row.processingOverdue

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({ children: [new Paragraph({ text: row.name })] }),
          new TableCell({
            children: [
              new Paragraph({ text: row.total.toString(), alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({ text: row.onTime.toString(), alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({ text: row.overdue.toString(), alignment: AlignmentType.CENTER }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: row.processingOnTime.toString(),
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: row.processingOverdue.toString(),
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      })
    )
  })

  // Total Row
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'TỔNG CỘNG', bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          columnSpan: 2,
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: totalReceived.toString(), bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: totalOnTime.toString(), bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: totalOverdue.toString(), bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: totalProcOnTime.toString(), bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: totalProcOverdue.toString(), bold: true })],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      ],
    })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134, // 2 cm
              bottom: 1134, // 2 cm
              left: 1701, // 3 cm
              right: 1134, // 2 cm
            },
          },
        },
        children: [
          // Header (Quốc hiệu, Tiêu ngữ)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'ỦY BAN NHÂN DÂN', size: 24 })],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'PHƯỜNG CẨM PHẢ',
                            size: 24,
                            bold: true,
                            underline: { type: 'single' },
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: 'Số: ..../BC-UBND', size: 26 })],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 35, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                            size: 24,
                            bold: true,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Độc lập - Tự do - Hạnh phúc',
                            size: 28,
                            bold: true,
                            underline: { type: 'single' },
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Cẩm Phả, ngày ... tháng ... năm ${year}`,
                            size: 28,
                            italics: true,
                          }),
                        ],
                        alignment: AlignmentType.CENTER,
                      }),
                    ],
                    width: { size: 65, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }), // Spacer

          // Title
          new Paragraph({
            children: [new TextRun({ text: 'BÁO CÁO', bold: true, size: 32 })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Tình hình tiếp nhận và xử lý văn bản đến',
                bold: true,
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `(Tháng ${month} năm ${year})`,
                italics: true,
                size: 28,
                underline: { type: 'single' },
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Intro
          new Paragraph({
            children: [
              new TextRun({
                text: `Thực hiện quy chế làm việc của Ủy ban nhân dân, UBND phường Cẩm Phả báo cáo tình hình tiếp nhận và xử lý văn bản đến của các cơ quan, đơn vị trực thuộc trong tháng ${month} năm ${year} cụ thể như sau:`,
                size: 28,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 720 }, // 0.5 inch indent
            spacing: { after: 400 },
          }),

          // The Data Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),

          new Paragraph({ text: '', spacing: { after: 400 } }), // Spacer

          // Footer (Signatures)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'Nơi nhận:', bold: true, italics: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: '- UBND tỉnh Quảng Ninh (b/c);', size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: '- Công an tỉnh (b/c);', size: 24 })],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: '- TT. Đảng ủy, HĐND phường (b/c);', size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: '- Chủ tịch, các PCT UBND;', size: 24 })],
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: '- Công an phường (biết);', size: 24 })],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: '- Các phòng, đơn vị: VP HĐND và UBND, VHXH, KTHTĐT, TT PVHCC (biết);',
                            size: 24,
                          }),
                        ],
                      }),
                      new Paragraph({ children: [new TextRun({ text: '- Lưu: VT.', size: 24 })] }),
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: 'CHÁNH VĂN PHÒNG', bold: true, size: 26 })],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({ text: '', spacing: { after: 1200 } }), // Spacer for signature
                    ],
                    width: { size: 50, type: WidthType.PERCENTAGE },
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  })

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `Bao_Cao_Van_Ban_Thang_${month}_${year}.docx`)
  })
}
