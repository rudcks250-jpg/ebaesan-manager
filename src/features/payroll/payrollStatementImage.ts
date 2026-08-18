import html2canvas from 'html2canvas';

async function createPayrollStatementFile(element: HTMLDivElement, filename: string): Promise<File> {
  await document.fonts.ready;
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (!element.isConnected || element.scrollWidth <= 0 || element.scrollHeight <= 0) {
    throw new Error('급여명세서 이미지 영역의 크기가 올바르지 않습니다.');
  }

  const canvas = await html2canvas(element, {
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
