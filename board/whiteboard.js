const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const resizer = document.querySelector('.resizer');
const contextMenu = document.getElementById('context-menu');
const layerList = document.getElementById('layer-list');
let drawing = false;
let selecting = false;
let resizing = false;
let movingImage = false;
let tool = 'arrow';
let startX, startY;
let currentX, currentY;
let selectedShapeIndex = null;
const savedShapes = [];
const selectedShapes = [];
const undoneShapes = [];
let clipboard = null;
let currentColor = '#ff0000'; // 初始設置為紅色

const setTool = (selectedTool) => {
    tool = selectedTool;
    canvas.style.cursor = 'crosshair';
    if (tool === 'moveImage') {
        canvas.style.cursor = 'move';
    }
};

const updateColor = () => {
    currentColor = document.getElementById('colorPicker').value;
};

const startResizing = (e) => {
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;
};

const stopResizing = () => {
    resizing = false;
};

const resizeCanvas = (e) => {
    if (!resizing) return;
    const newWidth = canvas.width + (e.clientX - startX);
    const newHeight = canvas.height + (e.clientY - startY);
    if (newWidth > 0 && newHeight > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = newWidth;
        canvas.height = newHeight;
        ctx.putImageData(imageData, 0, 0);
        redrawCanvas();
    }
    startX = e.clientX;
    startY = e.clientY;
};

resizer.addEventListener('mousedown', startResizing);
window.addEventListener('mousemove', resizeCanvas);
window.addEventListener('mouseup', stopResizing);

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) return; // Ignore right-click
    startX = e.offsetX;
    startY = e.offsetY;
    if (tool === 'rect' || tool === 'arrow' || tool === 'transparentRect' || tool === 'mosaicRect') {
        drawing = true;
    } else if (tool === 'select') {
        selecting = true;
        selectedShapes.length = 0;
        selectedShapeIndex = getShapeIndexAtCoordinates(startX, startY);
    } else if (tool === 'moveImage') {
        selectedShapeIndex = getShapeIndexAtCoordinates(startX, startY);
        if (selectedShapeIndex !== null && savedShapes[selectedShapeIndex].type === '插入圖片-') {
            movingImage = true;
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) return; // Ignore right-click
    if (drawing) {
        if (tool === 'arrow') {
            drawArrow(startX, startY, currentX, currentY, true);
        } else if (tool === 'rect') {
            drawRect(startX, startY, currentX, currentY, true);
        } else if (tool === 'transparentRect') {
            drawTransparentRect(startX, startY, currentX, currentY, true);
        } else if (tool === 'mosaicRect') {
            drawMosaicRect(startX, startY, currentX, currentY, true);
        }
    } else if (selecting) {
        selectedShapes.length = 0;
        const selectRect = {
            fromX: Math.min(startX, currentX),
            fromY: Math.min(startY, currentY),
            toX: Math.max(startX, currentX),
            toY: Math.max(startY, currentY)
        };
        savedShapes.forEach((shape, index) => {
            if (shapeInRect(shape, selectRect, 15)) {
                selectedShapes.push(index);
            }
        });
        redrawCanvas();
    }
    drawing = false;
    selecting = false;
    movingImage = false;
    ctx.beginPath();
});

canvas.addEventListener('mousemove', (e) => {
    currentX = e.offsetX;
    currentY = e.offsetY;
    if (!drawing && !selecting && !movingImage) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawCanvas();
    ctx.strokeStyle = currentColor;

    if (tool === 'arrow' && drawing) {
        drawArrow(startX, startY, currentX, currentY);
    } else if (tool === 'rect' && drawing) {
        drawRect(startX, startY, currentX, currentY);
    } else if (tool === 'transparentRect' && drawing) {
        drawTransparentRect(startX, startY, currentX, currentY);
    } else if (tool === 'mosaicRect' && drawing) {
        drawMosaicRect(startX, startY, currentX, currentY);
    } else if (tool === 'select' && selecting) {
        ctx.strokeStyle = 'blue';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
    } else if (tool === 'moveImage' && movingImage) {
        const shape = savedShapes[selectedShapeIndex];
        const dx = currentX - startX;
        const dy = currentY - startY;
        shape.x += dx;
        shape.y += dy;
        startX = currentX;
        startY = currentY;
        redrawCanvas();
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const x = e.offsetX;
    const y = e.offsetY;
    selectedShapeIndex = getShapeIndexAtCoordinates(x, y);
    if (selectedShapeIndex !== null) {
        contextMenu.style.top = `${e.pageY}px`;
        contextMenu.style.left = `${e.pageX}px`;
        contextMenu.style.display = 'block';
    }
});

window.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

const drawArrow = (fromX, fromY, toX, toY, final = false) => {
    ctx.lineWidth = 2;
    const headLength = 10; // length of head in pixels
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    const path = new Path2D();
    path.moveTo(fromX, fromY);
    path.lineTo(toX, toY);

    const headPath = new Path2D();
    headPath.moveTo(toX, toY);
    headPath.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    headPath.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    headPath.closePath();

    ctx.stroke(path);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill(headPath);

    if (final) {
        saveShape({
            type: '箭頭-',
            fromX,
            fromY,
            toX,
            toY,
            color: currentColor,
            path,
            headPath: headPath,
            boundingBox: {
                left: Math.min(fromX, toX) - 10,
                top: Math.min(fromY, toY) - 10,
                right: Math.max(fromX, toX) + 10,
                bottom: Math.max(fromY, toY) + 10
            }
        });
    }
};

const drawRect = (fromX, fromY, toX, toY, final = false) => {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(fromX, fromY, toX - fromX, toY - fromY);
    ctx.stroke();

    if (final) {
        saveShape({
            type: '外框-',
            fromX,
            fromY,
            toX,
            toY,
            color: currentColor
        });
    }
};

const drawTransparentRect = (fromX, fromY, toX, toY, final = false) => {
    ctx.globalAlpha = 0.2; // 更高透明度
    ctx.fillStyle = currentColor;
    ctx.fillRect(fromX, fromY, toX - fromX, toY - fromY);
    ctx.globalAlpha = 1.0;

    if (final) {
        saveShape({
            type: '螢光筆-',
            fromX,
            fromY,
            toX,
            toY,
            color: currentColor
        });
    }
};

const drawMosaicRect = (fromX, fromY, toX, toY, final = false) => {
    const mosaicSize = 10;
    const width = toX - fromX;
    const height = toY - fromY;
    for (let x = 0; x < width; x += mosaicSize) {
        for (let y = 0; y < height; y += mosaicSize) {
            const pixelData = ctx.getImageData(fromX + x, fromY + y, 1, 1).data;
            ctx.fillStyle = `rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`;
            ctx.fillRect(fromX + x, fromY + y, mosaicSize, mosaicSize);
        }
    }

    if (final) {
        saveShape({
            type: '馬賽克-',
            fromX,
            fromY,
            toX,
            toY
        });
    }
};

const saveShape = (shape) => {
    savedShapes.push(shape);
    undoneShapes.length = 0;
    updateLayerList();
};

const undo = () => {
    if (savedShapes.length > 0) {
        const shape = savedShapes.pop();
        undoneShapes.push(shape);
        redrawCanvas();
        updateLayerList();
    }
};

const redo = () => {
    if (undoneShapes.length > 0) {
        const shape = undoneShapes.pop();
        savedShapes.push(shape);
        redrawCanvas();
        updateLayerList();
    }
};

const redrawCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlaceholderText();
    savedShapes.forEach((shape, index) => {
        ctx.strokeStyle = shape.color || '#000';
        switch (shape.type) {
            case '箭頭-':
                ctx.stroke(shape.path);
                ctx.fill(shape.headPath);
                break;
            case '外框-':
                drawRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '螢光筆-':
                drawTransparentRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '馬賽克-':
                drawMosaicRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '插入圖片-':
                ctx.drawImage(shape.img, shape.x, shape.y, shape.width, shape.height);
                break;
        }
        if (selectedShapes.includes(index) || (selectedShapeIndex === index)) {
            highlightShape(shape);
        }
    });
};

const highlightShape = (shape) => {
    ctx.save();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 5;
    if (shape.type === '外框-' || shape.type === '螢光筆-' || shape.type === '馬賽克-') {
        ctx.strokeRect(shape.fromX, shape.fromY, shape.toX - shape從X, shape.toY - shape從Y);
    } else if (shape.type === '箭頭-') {
        ctx.stroke(shape.path);
        ctx.fill(shape.headPath); // 突出顯示箭頭
    } else if (shape.type === '插入圖片-') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }
    ctx.restore();
};

const shapeInRect = (shape, rect, tolerance = 0) => {
    const extendedRect = {
        fromX: rect.fromX - tolerance,
        fromY: rect.fromY - tolerance,
        toX: rect.toX + tolerance,
        toY: rect.toY + tolerance
    };
    if (shape.type === '外框-' || shape.type === '螢光筆-' || shape.type === '馬賽克-') {
        return (
            shape.fromX <= extendedRect.toX &&
            shape.toX >= extendedRect.fromX &&
            shape.fromY <= extendedRect.toY &&
            shape.toY >= extendedRect從Y
        );
    } else if (shape.type === '箭頭-') {
        return (
            shape.boundingBox.left <= extendedRect.toX &&
            shape.boundingBox.right >= extendedRect從X &&
            shape.boundingBox.top <= extendedRect從Y &&
            shape.boundingBox.bottom >= extendedRect從Y
        );
    } else if (shape.type === '插入圖片-') {
        return (
            shape.x <= extendedRect.toX &&
            shape.x + shape.width >= extendedRect從X &&
            shape.y <= extendedRect從Y &&
            shape.y + shape.height >= extendedRect從Y
        );
    }
    return false;
};

const getShapeIndexAtCoordinates = (x, y) => {
    const tolerance = 15; // 增加選取寬容度

    for (let i = savedShapes.length - 1; i >= 0; i--) {
        const shape = savedShapes[i];
        if (shape.type === '外框-' || shape.type === '螢光筆-' || shape.type === '馬賽克-') {
            if (ctx.isPointInPath(shape.path, x, y) || isWithinTolerance(x, y, shape, tolerance)) {
                return i;
            }
        } else if (shape.type === '箭頭-') {
            if (isWithinBoundingBox(x, y, shape.boundingBox)) {
                return i;
            }
        } else if (shape.type === '插入圖片-') {
            if (x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height) {
                return i;
            }
        }
    }
    return null;
};

const isWithinTolerance = (x, y, shape, tolerance) => {
    if (shape.type === '外框-' || shape.type === '螢光筆-' || shape.type === '馬賽克-') {
        return (
            x >= shape.fromX - tolerance &&
            x <= shape.toX + tolerance &&
            y >= shape.fromY - tolerance &&
            y <= shape.toY + tolerance
        );
    } else if (shape.type === '箭頭-') {
        return isWithinBoundingBox(x, y, shape.boundingBox);
    }
    return false;
};

const isWithinBoundingBox = (x, y, boundingBox) => {
    return (
        x >= boundingBox.left &&
        x <= boundingBox.right &&
        y >= boundingBox.top &&
        y <= boundingBox.bottom
    );
};

const deleteShape = () => {
    if (selectedShapeIndex !== null) {
        savedShapes.splice(selectedShapeIndex, 1);
        selectedShapeIndex = null;
        redrawCanvas();
        updateLayerList();
    }
};

const pasteImage = async (event) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            const img = new Image();
            img.onload = () => {
                resizeCanvasToImage(img.width, img.height);
                drawImage(img, 0, 0, true);
            };
            img.src = URL.createObjectURL(blob);
        }
    }
};

const resizeCanvasToImage = (width, height) => {
    canvas.width = width;
    canvas.height = height;
};

const exportImage = () => {
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'whiteboard.png';
    link.click();
};

const drawImage = (img, x, y, final = false) => {
    const width = img.width;
    const height = img.height;
    ctx.drawImage(img, x, y, width, height);
    if (final) {
        saveShape({
            type: '插入圖片-',
            img,
            x,
            y,
            width,
            height
        });
    }
};

const drawPlaceholderText = () => {
    ctx.save();
    ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('【ctrl+v可直接貼上圖片】', canvas.width / 2, canvas.height / 2);
    ctx.restore();
};

window.addEventListener('paste', pasteImage);

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
        undo();
    } else if (e.ctrlKey && e.key === 'y') {
        redo();
    } else if (e.key === 'Delete') {
        deleteShape();
    } else if (e.ctrlKey && e.key === 'v' && clipboard) {
        clipboard.forEach(shape => {
            savedShapes.push({
                ...shape,
                x: shape.x + 10,
                y: shape.y + 10
            });
        });
        redrawCanvas();
    }
});

const exportAndCopyImage = () => {
    canvas.toBlob(blob => {
        const item = new ClipboardItem({ 'image/png': blob });
        navigator.clipboard.write([item]).then(() => {
            alert('圖檔已輸出並複製到剪貼簿');
        }).catch(err => {
            console.error('複製到剪貼簿失敗: ', err);
        });
    });
};

// 更新图层清单
const updateLayerList = () => {
    layerList.innerHTML = '';
    savedShapes.forEach((shape, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${shape.type} ${index + 1}`;
        listItem.onclick = () => {
            selectedShapeIndex = index;
            selectedShapes.length = 0;
            selectedShapes.push(index);
            redrawCanvas();
        };
        layerList.appendChild(listItem);
    });
};

// 初始化时绘制灰色底字
drawPlaceholderText();
updateLayerList();
