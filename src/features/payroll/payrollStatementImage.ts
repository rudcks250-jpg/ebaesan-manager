import html2canvas from 'html2canvas';

const MAX_CANVAS_AREA = 16_000_000;

function captureScale(width: number, height: number): number {
  const preferred = Math.max(2, Math.min(3, window.devicePixelRatio || 2));
  const safe = Math.sqrt(MAX_CANVAS_AREA / Math.max(1, width * height));
  return Math.max(1, Math.min(preferred, safe));
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
    // 최신 Tailwind 색상 함수는 html2canvas 파서보다 브라우저 렌더러가 더 안정적입니다.
    return await html2canvas(element, { ...options, foreignObjectRendering: true });
  } catch (primaryError) {
    console.warn('[PayrollStatement] browser-render capture failed; retrying canvas renderer', primaryError);
    return html2canvas(element, { ...options, foreignObjectRendering: false });
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

export async function sharePayrollStatement(
  element: HTMLDivElement,
  filename: string,
): Promise<'shared' | 'downloaded'> {
  const file = await createPayrollStatementFile(element, filename);
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: '이배산 숯불구이 급여 근무내역 확인서',
      text: '급여기간의 근무내역과 예상 급여를 확인해주세요.',
      files: [file],
    });
    return 'shared';
  }
  downloadFile(file);
  return 'downloaded';
}
