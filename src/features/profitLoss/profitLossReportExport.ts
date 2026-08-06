import html2canvas from 'html2canvas';

async function capturePage(element: HTMLElement): Promise<HTMLCanvasElement> {
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!element.isConnected || element.scrollWidth <= 0 || element.scrollHeight <= 0) {
    throw new Error('보고서 페이지의 크기가 올바르지 않습니다.');
  }
  return html2canvas(element, {
    scale: Math.max(2, Math.min(3, window.devicePixelRatio || 2)),
    backgroundColor: '#FFFFFF',
    useCORS: true,
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    scrollX: 0,
    scrollY: 0,
  });
}

async function canvasToPngFile(canvas: HTMLCanvasElement, filename: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('PNG 생성에 실패했습니다.')),
    'image/png',
  ));
  return new File([blob], filename, { type: 'image/png' });
}

async function createReportFiles(container: HTMLDivElement, baseFilename: string): Promise<File[]> {
  const pages = [...container.querySelectorAll<HTMLElement>('[data-profit-report-page]')];
  if (pages.length === 0) throw new Error('보고서 페이지를 찾을 수 없습니다.');
  const files: File[] = [];
  for (const [index, page] of pages.entries()) {
    const canvas = await capturePage(page);
    files.push(await canvasToPngFile(canvas, `${baseFilename}_${String(index + 1).padStart(2, '0')}.png`));
  }
  return files;
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportReportPngs(container: HTMLDivElement, baseFilename: string): Promise<number> {
  const files = await createReportFiles(container, baseFilename);
  for (const [index, file] of files.entries()) {
    if (index > 0) await new Promise((resolve) => window.setTimeout(resolve, 180));
    downloadFile(file);
  }
  return files.length;
}

export async function shareReportPages(
  container: HTMLDivElement,
  baseFilename: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  const files = await createReportFiles(container, baseFilename);
  if (navigator.share && navigator.canShare?.({ files })) {
    await navigator.share({ title, files });
    return 'shared';
  }
  for (const [index, file] of files.entries()) {
    if (index > 0) await new Promise((resolve) => window.setTimeout(resolve, 180));
    downloadFile(file);
  }
  return 'downloaded';
}
