const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const canvasContainer = document.getElementById('canvas-container');
const resizer = document.querySelector('.resizer');
const contextMenu = document.getElementById('context-menu');
let drawing = false;
let selecting = false;
let resizing = false;
let tool = 'arrow';
let startX, startY;
let currentX, currentY;
let selectedShapeIndex = null;
const savedShapes = [];
const selectedShapes = [];
const undoneShapes = [];
let clipboard = null;
let currentColor = document.getElementById('colorPicker').value;

const setTool = (selectedTool) => {
    tool = selectedTool;
    canvas.style.cursor = 'crosshair';
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
    if (tool === 'rect' || tool === 'arrow') {
        drawing = true;
    } else if (tool === 'select') {
        selecting = true;
        selectedShapes.length = 0;
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) return; // Ignore right-click
    if (drawing) {
        if (tool === 'arrow') {
            drawArrow(startX, startY, currentX, currentY, true);
        } else if (tool === 'rect') {
            drawRect(startX, startY, currentX, currentY, true);
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
    }
    drawing = false;
    selecting = false;
    ctx.beginPath();
});

canvas.addEventListener('mousemove', (e) => {
    currentX = e.offsetX;
    currentY = e.offsetY;
    if (!drawing && !selecting) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    redrawCanvas();
    ctx.strokeStyle = currentColor;

    if (tool === 'arrow' && drawing) {
        drawArrow(startX, startY, currentX, currentY);
    } else if (tool === 'rect' && drawing) {
        drawRect(startX, startY, currentX, currentY);
    } else if (tool === 'select' && selecting) {
        ctx.strokeStyle = 'blue';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
        ctx.setLineDash([]);
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

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.stroke();

    if (final) {
        saveShape({ type: 'arrow', fromX, fromY, toX, toY, color: currentColor });
    }
};

const drawRect = (fromX, fromY, toX, toY, final = false) => {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(fromX, fromY, toX - fromX, toY - fromY);
    ctx.stroke();

    if (final) {
        saveShape({ type: 'rect', fromX, fromY, toX, toY, color: currentColor });
    }
};

const saveShape = (shape) => {
    savedShapes.push(shape);
    undoneShapes.length = 0;
};

const undo = () => {
    if (savedShapes.length > 0) {
        const shape = savedShapes.pop();
        undoneShapes.push(shape);
        redrawCanvas();
    }
};

const redo = () => {
    if (undoneShapes.length > 0) {
        const shape = undoneShapes.pop();
        savedShapes.push(shape);
        redrawCanvas();
    }
};

const redrawCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    savedShapes.forEach((shape, index) => {
        ctx.strokeStyle = shape.color || '#000';
        switch (shape.type) {
            case 'arrow':
                drawArrow(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case 'rect':
                drawRect(shape.fromX, shape.fromY, shape.toX, shape.toY);
                break;
            case 'image':
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
    if (shape.type === 'rect') {
        ctx.strokeRect(shape.fromX, shape.fromY, shape.toX - shape.fromX, shape.toY - shape.fromY);
    } else if (shape.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(shape.fromX, shape.fromY);
        ctx.lineTo(shape.toX, shape.toY);
        ctx.stroke();
    } else if (shape.type === 'image') {
        ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }
    ctx.restore();
};

const shapeInRect = (shape, rect) => {
    if (shape.type === 'rect') {
        return shape.fromX >= rect.fromX && shape.toX <= rect.toX && shape.fromY >= rect.fromY && shape.toY <= rect.toY;
    } else if (shape.type === 'arrow') {
        return shape.fromX >= rect.fromX && shape.toX <= rect.toX && shape.fromY >= rect.fromY && shape.toY <= rect.toY;
    } else if (shape.type === 'image') {
        return shape.x >= rect.fromX && (shape.x + shape.width) <= rect.toX && shape.y >= rect.fromY && (shape.y + shape.height) <= rect.toY;
    }
    return false;
};

const getShapeIndexAtCoordinates = (x, y) => {
    for (let i = savedShapes.length - 1; i >= 0; i--) {
        const shape = savedShapes[i];
        if (shape.type === 'rect') {
            if (x >= shape.fromX && x <= shape.toX && y >= shape.fromY && y <= shape.toY) {
                return i;
            }
        } else if (shape.type === 'arrow') {
            const dx = shape.toX - shape.fromX;
            const dy = shape.toY - shape.fromY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const dot = ((x - shape.fromX) * dx + (y - shape.fromY) * dy) / (length * length);
            const closestX = shape.fromX + dot * dx;
            const closestY = shape.fromY + dot * dy;
            const distance = Math.sqrt((x - closestX) * (x - closestX) + (y - closestY) * (y - closestY));
            if (distance < 5) {
                return i;
            }
        } else if (shape.type === 'image') {
            if (x >= shape.x && x <= shape.x + shape.width && y >= shape.y && y <= shape.y + shape.height) {
                return i;
            }
        }
    }
    return null;
};

const deleteShape = () => {
    if (selectedShapeIndex !== null) {
        savedShapes.splice(selectedShapeIndex, 1);
        selectedShapeIndex = null;
        redrawCanvas();
    }
};

const pasteImage = async (event) => {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let index in items) {
        const item = items[index];
        if (item.kind === 'file') {
            const blob = item.getAsFile();
            const img = new Image();
            img.onload = () => drawImage(img, 10, 10, true);
            img.src = URL.createObjectURL(blob);
        }
    }
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
        saveShape({ type: 'image', img, x, y, width, height });
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
            savedShapes.push({ ...shape, x: shape.x + 10, y: shape.y + 10 });
        });
        redrawCanvas();
    }
});
