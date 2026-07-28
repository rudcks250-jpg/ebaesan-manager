import html2canvas from 'html2canvas';

export async function exportSchedulePng(element: HTMLDivElement, filename: string) {
  await document.fonts.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );

  if (!element.isConnected) {
    throw new Error('스케줄 내보내기 요소가 DOM에 연결되어 있지 않습니다.');
  }
  const width = element.scrollWidth;
  const height = element.scrollHeight;
  if (width <= 0 || height <= 0) {
    throw new Error(`스케줄 내보내기 요소의 크기가 올바르지 않습니다. (${width}×${height})`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#F5F5F7',
    useCORS: true,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    onclone: (clonedDocument) => {
      const target = clonedDocument.querySelector<HTMLElement>('[data-schedule-export="true"]');
      if (!target) throw new Error('복제된 문서에서 스케줄 내보내기 요소를 찾지 못했습니다.');
      target.style.position = 'absolute';
      target.style.left = '0';
      target.style.top = '0';
    },
  });

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error('PNG 생성에 실패했습니다.')),
      'image/png'
    )
  );
  const file = new File([blob], filename, { type: 'image/png' });
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  if (mobile && navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: '이배산 숯불구이 근무표', files: [file] });
    return;
  }

  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}
