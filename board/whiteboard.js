const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const resizer = document.querySelector('.resizer');
const contextMenu = document.getElementById('context-menu');
let drawing = false;
let selecting = false;
let resizing = false;
let moving = false;
let tool = 'arrow';
let startX, startY;
let currentX, currentY;
let selectedShapeIndex = null;
let hasLoadedImage = false;
const savedShapes = [];
const selectedShapes = [];
const undoneShapes = [];
let clipboard = null;
let currentColor = '#ff0000'; 

const setTool = (selectedTool) => {
    tool = selectedTool;
    if (tool === 'moveImage') {
        canvas.style.cursor = 'move';
    } else if (tool === 'select') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'crosshair';
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
    if (!hasLoadedImage) {
        loadImage();
    } else if (tool === 'rect' || tool === 'arrow' || tool === 'transparentRect' || tool === 'mosaicRect') {
        drawing = true;
    } else if (tool === 'select') {
        selecting = true;
        selectedShapes.length = 0;
        selectedShapeIndex = getShapeIndexAtCoordinates(startX, startY);
    } else if (tool === 'moveImage') {
        selectedShapeIndex = getShapeIndexAtCoordinates(startX, startY);
        if (selectedShapeIndex !== null) {
            moving = true;
            startX = e.offsetX;
            startY = e.offsetY;
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
            if (shapeInRect(shape, selectRect)) {
                selectedShapes.push(index);
            }
        });
        redrawCanvas();
    } else if (moving) {
        moving = false;
    }
    drawing = false;
    selecting = false;
    ctx.beginPath();
});

canvas.addEventListener('mousemove', (e) => {
    currentX = e.offsetX;
    currentY = e.offsetY;
    if (!drawing && !selecting && !moving) return;
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
    } else if (tool === 'moveImage' && moving) {
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

    path.moveTo(toX, toY);
    path.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    path.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    path.lineTo(toX, toY);
    path.closePath();

    ctx.stroke(path);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill(path);

    if (final) {
        saveShape({
            type: '箭頭',
            fromX,
            fromY,
            toX,
            toY,
            color: currentColor,
            path,
            headPath: new Path2D(path)
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
            type: '外框',
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
            type: '螢光筆',
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
            type: '馬賽克',
            fromX,
            fromY,
            toX,
            toY
        });
    }
};

const saveShape = (shape) => {
    savedShapes.push(shape);
    updateLayerList();
    undoneShapes.length = 0;
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
            case '箭頭':
                drawArrow(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '外框':
                drawRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '螢光筆':
                drawTransparentRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '馬賽克':
                drawMosaicRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case '插入圖片':
                ctx.drawImage(shape.img, shape.x, shape.y, shape.width, shape.height);
                break;
        }
        if (selectedShapes.includes(index) || selectedShapeIndex === index) {
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
    if (shape.type === '外框' || shape.type === '螢光筆' || shape.type === '馬賽克') {
        ctx.strokeRect(shape.fromX, shape.fromY, shape.toX - shape.fromX, shape.toY - shape.fromY);
    } else if (shape.type === '箭頭') {
        ctx.beginPath();
        ctx.moveTo(shape.fromX, shape.fromY);
        ctx.lineTo(shape.toX, shape.toY);
        ctx.stroke();
        ctx.fill(shape.headPath); // Highlight arrow head
    } else if (shape.type === '插入圖片') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }
    ctx.restore();
};

const shapeInRect = (shape, rect) => {
    if (shape.type === '外框' || shape.type === '螢光筆' || shape.type === '馬賽克') {
        return shape.fromX >= rect.fromX && shape.toX <= rect.toX && shape.fromY >= rect.fromY && shape.toY <= rect.toY;
    } else if (shape.type === '箭頭') {
        return shape.fromX >= rect.fromX && shape.toX <= rect.toX && shape.fromY >= rect.fromY && shape.toY <= rect.toY;
    } else if (shape.type === '插入圖片') {
        return shape.x >= rect.fromX && (shape.x + shape.width) <= rect.toX && shape.y >= rect.fromY && (shape.y + shape.height) <= rect.toY;
    }
    return false;
};

const getShapeIndexAtCoordinates = (x, y) => {
    const tolerance = 5; // Increase the tolerance for selection

    for (let i = savedShapes.length - 1; i >= 0; i--) {
        const shape = savedShapes[i];
        if (shape.type === '外框' || shape.type === '螢光筆' || shape.type === '馬賽克') {
            if (x >= shape.fromX && x <= shape.toX && y >= shape.fromY && y <= shape.toY) {
                return i;
            }
        } else if (shape.type === '箭頭') {
            // Check if the point is within a reasonable distance of the arrow path
            const path = new Path2D();
            path.moveTo(shape.fromX, shape.fromY);
            path.lineTo(shape.toX, toY);
            path.lineTo(shape.toX - 10 * Math.cos(Math.atan2(shape.toY - shape.fromY, shape.toX - shape.fromX) - Math.PI / 6), shape.toY - 10 * Math.sin(Math.atan2(shape.toY - shape.fromY, shape.toX - shape.fromX) - Math.PI / 6));
            path.lineTo(shape.toX, shape.toY);
            path.lineTo(shape.toX - 10 * Math.cos(Math.atan2(shape.toY - shape.fromY, shape.toX - shape.fromX) + Math.PI / 6), shape.toY - 10 * Math.sin(Math.atan2(shape.toY - shape.fromY, shape.toX - shape.fromX) + Math.PI / 6));
            ctx.lineWidth = tolerance;
            if (ctx.isPointInStroke(path, x, y) || ctx.isPointInPath(shape.headPath, x, y)) {
                return i;
            }
        } else if (shape.type === '插入圖片') {
            if (x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height) {
                return i;
            }
        }
    }
    return null;
};

const deleteShape = (index = selectedShapeIndex) => {
    if (index !== null) {
        savedShapes.splice(index, 1);
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
                hasLoadedImage = true;
            };
            img.src = URL.createObjectURL(blob);
        }
    }
};

const loadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
        const file = event.target.files[0];
        const img = new Image();
        img.onload = () => {
            resizeCanvasToImage(img.width, img.height);
            drawImage(img, 0, 0, true);
            hasLoadedImage = true;
        };
        img.src = URL.createObjectURL(file);
    };
    input.click();
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
            type: '插入圖片',
            img,
            x,
            y,
            width,
            height
        });
    }
};

const drawPlaceholderText = () => {
    if (!hasLoadedImage) {
        ctx.save();
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('【ctrl+v可直接貼上圖片】', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
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
        updateLayerList();
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

// 更新图层列表
const updateLayerList = () => {
    const layerList = document.getElementById('layer-list');
    layerList.innerHTML = '';
    savedShapes.forEach((shape, index) => {
        const li = document.createElement('li');
        li.className = 'layer-item';
        li.textContent = `${index + 1}: ${shape.type}`;
        const deleteIcon = document.createElement('span');
        deleteIcon.textContent = 'x';
        deleteIcon.className = 'delete-icon';
        deleteIcon.onclick = (e) => {
            e.stopPropagation();
            deleteShape(index);
        };
        li.appendChild(deleteIcon);
        if (selectedShapeIndex === index) {
            li.classList.add('selected');
            deleteIcon.style.display = 'inline';
        } else {
            deleteIcon.style.display = 'none';
        }
        li.onclick = () => {
            selectedShapeIndex = index;
            redrawCanvas();
            updateLayerList();
        };
        layerList.appendChild(li);
    });
};

// 初始化时绘制灰色底字
drawPlaceholderText();
redrawCanvas();
