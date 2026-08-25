import html2canvas from 'html2canvas';

const MAX_CANVAS_AREA = 16_000_000;

function captureScale(width: number, height: number): number {
  const preferred = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
  const safe = Math.sqrt(MAX_CANVAS_AREA / Math.max(1, width * height));
  return Math.max(1, Math.min(preferred, safe));
}

function hasRenderedContent(canvas: HTMLCanvasElement): boolean {
  const sample = document.createElement('canvas');
  sample.width = 48;
  sample.height = 48;
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(canvas, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
      return true;
    }
  }
  return false;
}

async function renderAndValidate(
  element: HTMLDivElement,
  options: Parameters<typeof html2canvas>[1],
  foreignObjectRendering: boolean,
): Promise<HTMLCanvasElement> {
  const canvas = await html2canvas(element, { ...options, foreignObjectRendering });
  if (!hasRenderedContent(canvas)) {
    throw new Error('급여명세서 내용이 이미지에 렌더링되지 않았습니다.');
  }
  return canvas;
}

async function capturePayrollStatement(element: HTMLDivElement): Promise<HTMLCanvasElement> {
  const width = element.scrollWidth;
  const height = element.scrollHeight;
  const options = {
    scale: captureScale(width, height),
    backgroundColor: '#FFFFFF',
    useCORS: true,
    allowTaint: false,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument: Document) => {
      const target = clonedDocument.querySelector<HTMLElement>('[data-payroll-statement-report]');
      if (!target) throw new Error('복제된 문서에서 급여명세서 영역을 찾지 못했습니다.');
      target.style.position = 'absolute';
      target.style.left = '0';
      target.style.top = '0';
      target.style.boxShadow = 'none';
    },
  };

  try {
    // 보고서 전용 색상은 안전한 HEX로 구성되어 기본 캔버스 렌더러를 우선 사용합니다.
    return await renderAndValidate(element, options, false);
  } catch (primaryError) {
    console.warn('[PayrollStatement] canvas capture failed; retrying browser renderer', primaryError);
    return renderAndValidate(element, options, true);
  }
}

async function createPayrollStatementFile(element: HTMLDivElement, filename: string): Promise<File> {
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!element.isConnected || element.scrollWidth <= 0 || element.scrollHeight <= 0) {
    throw new Error('급여명세서 이미지 영역의 크기가 올바르지 않습니다.');
  }

  const canvas = await capturePayrollStatement(element);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error('PNG 생성에 실패했습니다.')),
    'image/png',
  ));
  return new File([blob], filename, { type: 'image/png' });
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

export async function downloadPayrollStatement(element: HTMLDivElement, filename: string): Promise<void> {
  downloadFile(await createPayrollStatementFile(element, filename));
}
