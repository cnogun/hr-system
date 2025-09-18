/**
 * 인쇄 최적화 JavaScript
 * 작성자: 시스템 관리자
 * 목적: 인쇄 미리보기 및 최적화 기능 제공
 */

// 인쇄 미리보기 기능
function showPrintPreview() {
    // 기존 미리보기가 있으면 제거
    const existingPreview = document.getElementById('printPreviewModal');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // 미리보기 모달 생성
    const previewModal = document.createElement('div');
    previewModal.className = 'print-preview';
    previewModal.id = 'printPreviewModal';
    
    // 인쇄할 컨텐츠만 복사 (body 전체가 아닌 컨테이너만)
    const mainContent = document.querySelector('.container') || document.querySelector('main') || document.body;
    const contentClone = mainContent.cloneNode(true);
    
    previewModal.innerHTML = `
        <div class="print-preview-content">
            <div class="print-preview-header">
                <h4>인쇄 미리보기</h4>
                <div>
                    <button class="print-preview-print" onclick="printFromPreview()">인쇄</button>
                    <button class="print-preview-close" onclick="closePrintPreview()">닫기</button>
                </div>
            </div>
            <div class="print-content">
            </div>
        </div>
    `;
    
    // 복사된 컨텐츠를 미리보기 영역에 추가
    const printContent = previewModal.querySelector('.print-content');
    printContent.appendChild(contentClone);
    
    document.body.appendChild(previewModal);
    previewModal.style.display = 'block';
    
    // 스크롤 방지
    document.body.style.overflow = 'hidden';
}

// 인쇄 미리보기 닫기
function closePrintPreview() {
    const previewModal = document.getElementById('printPreviewModal');
    if (previewModal) {
        previewModal.remove();
        document.body.style.overflow = 'auto';
    }
}

// 미리보기에서 인쇄 실행
function printFromPreview() {
    // 미리보기 창에서 인쇄 실행
    window.print();
}

// ESC 키로 미리보기 닫기
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closePrintPreview();
    }
});

// 인쇄 최적화 함수
function optimizeForPrint() {
    // 인쇄 시 불필요한 요소 숨김
    const elementsToHide = [
        '.no-print',
        '.btn:not(.print-btn):not(.print-preview-btn)',
        'button:not(.print-btn):not(.print-preview-btn)',
        'header',
        'footer',
        '.navbar',
        '.modal',
        '.toast'
    ];
    
    elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.style.display = 'none';
        });
    });
    
    // 테이블 최적화 및 바깥쪽 테두리 강제 적용
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        // 테이블 자체의 바깥쪽 테두리 강제 적용
        table.style.border = '1px solid #333';
        table.style.setProperty('border', '1px solid #333', 'important');
        table.style.borderCollapse = 'collapse';
        table.style.setProperty('border-collapse', 'collapse', 'important');
        
        // 페이지 브레이크 방지 적용
        table.style.pageBreakInside = 'avoid';
        table.style.breakInside = 'avoid';
        
        console.log('표 테두리 적용:', table.className || '일반 표');
    });
    
    // 섹션 최적화
    const sections = document.querySelectorAll('.form-section, .section');
    sections.forEach(section => {
        section.style.pageBreakInside = 'avoid';
        section.style.breakInside = 'avoid';
    });
    
    // 인원현황 표 텍스트 사이즈 강제 적용
    const formSectionTables = document.querySelectorAll('.form-section table');
    formSectionTables.forEach(table => {
        // 인원현황 섹션인지 확인 (섹션 헤더에 "인원 현황"이 포함된 경우)
        const sectionHeader = table.closest('.form-section')?.querySelector('.section-header');
        const isPersonnelSection = sectionHeader && sectionHeader.textContent.includes('인원 현황');
        
        // 테이블 내부 모든 요소의 폰트 사이즈를 12px로 강제 설정
        const allElements = table.querySelectorAll('*');
        allElements.forEach(element => {
            element.style.fontSize = '12px';
            element.style.setProperty('font-size', '12px', 'important');
        });
        
        // 테이블 자체의 폰트 사이즈도 설정
        table.style.fontSize = '12px';
        table.style.setProperty('font-size', '12px', 'important');
        
        // 인라인 스타일이 있는 요소들 강제 변경
        const elementsWithInlineStyle = table.querySelectorAll('[style*="font-size"]');
        elementsWithInlineStyle.forEach(element => {
            element.style.fontSize = '12px';
            element.style.setProperty('font-size', '12px', 'important');
        });
        
        // 인원현황 섹션인 경우 추가 처리
        if (isPersonnelSection) {
            console.log('인원현황 섹션 감지 - 추가 최적화 적용');
            
            // 모든 th, td 요소에 강제 적용
            const thElements = table.querySelectorAll('th');
            const tdElements = table.querySelectorAll('td');
            
            [...thElements, ...tdElements].forEach(element => {
                element.style.fontSize = '12px';
                element.style.setProperty('font-size', '12px', 'important');
                element.style.setProperty('font-size', '12px', 'important');
            });
            
            // 테이블 내부의 모든 div, span 요소도 처리
            const divElements = table.querySelectorAll('div');
            const spanElements = table.querySelectorAll('span');
            
            [...divElements, ...spanElements].forEach(element => {
                element.style.fontSize = '12px';
                element.style.setProperty('font-size', '12px', 'important');
            });
        }
    });
}

// 인쇄 전 최적화 적용
window.addEventListener('beforeprint', function() {
    optimizeForPrint();
});

// 인쇄 후 원상복구
window.addEventListener('afterprint', function() {
    // 숨긴 요소들 다시 표시
    const hiddenElements = document.querySelectorAll('[style*="display: none"]');
    hiddenElements.forEach(element => {
        element.style.display = '';
    });
});

// 인쇄 버튼 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', function() {
    // 기존 인쇄 버튼들을 찾아서 이벤트 리스너 추가
    const printButtons = document.querySelectorAll('button[onclick*="print"], .btn[onclick*="print"]');
    
    printButtons.forEach(button => {
        // 기존 onclick 이벤트 제거하고 새로운 이벤트 추가
        const originalOnclick = button.getAttribute('onclick');
        button.removeAttribute('onclick');
        
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Ctrl 키를 누르고 있으면 미리보기 표시
            if (e.ctrlKey || e.metaKey) {
                showPrintPreview();
            } else {
                // 일반 인쇄 실행
                optimizeForPrint();
                setTimeout(() => {
                    window.print();
                }, 100);
            }
        });
    });
    
    // 인쇄 미리보기 버튼 추가
    const printButtonsWithPreview = document.querySelectorAll('.btn-group, .button-group');
    
    printButtonsWithPreview.forEach(buttonGroup => {
        const printButton = buttonGroup.querySelector('button[onclick*="print"], .btn[onclick*="print"]');
        if (printButton) {
            // 미리보기 버튼 생성
            const previewButton = document.createElement('button');
            previewButton.className = 'btn btn-info print-preview-btn';
            previewButton.innerHTML = '미리보기';
            previewButton.onclick = showPrintPreview;
            
            // 인쇄 버튼 앞에 미리보기 버튼 삽입
            printButton.parentNode.insertBefore(previewButton, printButton);
        }
    });
});

// 모든 표의 바깥쪽 테두리 강제 적용 함수
function forceTableBorders() {
    console.log('표 테두리 강제 적용 시작');
    
    const allTables = document.querySelectorAll('table');
    allTables.forEach(table => {
        // 테이블 자체의 바깥쪽 테두리 강제 적용
        table.style.border = '1px solid #ddd';
        table.style.setProperty('border', '1px solid #ddd', 'important');
        table.style.borderCollapse = 'collapse';
        table.style.setProperty('border-collapse', 'collapse', 'important');
        
        console.log('표 테두리 적용:', table.className || '일반 표');
    });
}

// 페이지 로드 완료 후 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        // DOM 로드 완료 후 모든 표의 테두리 강제 적용
        forceTableBorders();
        
        // 0.5초 후 다시 한 번 적용 (동적 로딩 대비)
        setTimeout(forceTableBorders, 500);
    });
} else {
    // DOM이 이미 로드된 경우 즉시 실행
    forceTableBorders();
    setTimeout(forceTableBorders, 500);
}
