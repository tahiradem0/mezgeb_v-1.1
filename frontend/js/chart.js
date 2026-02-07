/* ===================================
   EXPENSE TRACKER - Chart Module
   Beautiful smooth bar charts with tooltips
   =================================== */

class ExpenseChart {
    constructor(canvasId, type = 'bar') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.type = type;
        this.data = null;
        this.animationProgress = 0;
        this.animationId = null;
        this.hoveredIndex = -1;
        this.selectedIndex = -1;

        // Color scheme: #333 default, green on hover
        this.colors = {
            primary: '#333333',
            barDefault: '#333333',       // Default bar color
            barActive: '#4CAF50',         // Green on hover/active
            grid: '#F0F0F0',
            text: '#999999',
            textDark: '#333333',
            background: '#FFFFFF'
        };

        this.padding = {
            top: 50,
            right: 20,
            bottom: 40,
            left: 45
        };

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Mouse events for interactivity
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    resize() {
        const container = this.canvas.parentElement;
        if (!container) return;

        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = container.clientWidth * dpr;
        this.canvas.height = container.clientHeight * dpr;
        this.canvas.style.width = container.clientWidth + 'px';
        this.canvas.style.height = container.clientHeight + 'px';

        this.ctx.scale(dpr, dpr);

        this.width = container.clientWidth;
        this.height = container.clientHeight;

        if (this.data) {
            this.draw();
        }
    }

    setData(data) {
        if (!data || !data.labels || !data.positive) {
            console.warn('Invalid chart data');
            return;
        }
        this.data = data;
        this.selectedIndex = -1;
        this.animateIn();
    }

    animateIn() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }

        this.animationProgress = 0;
        const animate = () => {
            this.animationProgress += 0.035;
            if (this.animationProgress >= 1) {
                this.animationProgress = 1;
                this.draw();
                return;
            }
            this.draw();
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }

    handleMouseMove(e) {
        if (!this.data) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const barIndex = this.getBarIndexAtPosition(x);
        if (barIndex !== this.hoveredIndex) {
            this.hoveredIndex = barIndex;
            this.canvas.style.cursor = barIndex >= 0 ? 'pointer' : 'default';
            this.draw();
        }
    }

    handleMouseLeave() {
        this.hoveredIndex = -1;
        this.draw();
    }

    handleClick(e) {
        if (!this.data) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const barIndex = this.getBarIndexAtPosition(x);
        if (barIndex >= 0) {
            this.selectedIndex = this.selectedIndex === barIndex ? -1 : barIndex;
            this.draw();
        }
    }

    getBarIndexAtPosition(x) {
        if (!this.data || !this.data.labels) return -1;

        const { labels } = this.data;
        const chartWidth = this.width - this.padding.left - this.padding.right;
        const barGroupWidth = chartWidth / labels.length;

        const adjustedX = x - this.padding.left;
        if (adjustedX < 0 || adjustedX > chartWidth) return -1;

        return Math.floor(adjustedX / barGroupWidth);
    }

    updateThemeColors() {
        const isDark = document.documentElement.dataset.theme === 'dark';
        this.colors = {
            ...this.colors,
            primary: isDark ? '#FFFFFF' : '#333333',
            barDefault: isDark ? '#BBBBBB' : '#333333',
            barActive: '#4CAF50',
            grid: isDark ? '#333333' : '#F0F0F0',
            text: isDark ? '#AAAAAA' : '#999999',
            textDark: isDark ? '#FFFFFF' : '#333333',
            background: isDark ? '#1A1A1A' : '#FFFFFF'
        };
    }

    draw() {
        if (!this.ctx || !this.width || !this.height) return;

        this.updateThemeColors();
        this.ctx.clearRect(0, 0, this.width, this.height);

        if (!this.data || !this.data.labels || !this.data.positive) return;

        if (this.type === 'bar') {
            this.drawBarChart();
        } else if (this.type === 'line') {
            this.drawLineChart();
        }
    }

    drawBarChart() {
        const { labels, positive } = this.data;
        if (!labels || !positive || labels.length === 0) return;

        const chartWidth = this.width - this.padding.left - this.padding.right;
        const chartHeight = this.height - this.padding.top - this.padding.bottom;

        const barGroupWidth = chartWidth / labels.length;
        const barWidth = Math.min(28, barGroupWidth * 0.5);

        // Find max value for scaling
        const maxValue = Math.max(...positive, 1);
        const roundedMax = this.roundToNice(maxValue);

        // Draw Y-axis labels and grid lines
        this.drawYAxis(roundedMax, chartHeight);

        // Draw bars with smooth animation
        labels.forEach((label, index) => {
            const x = this.padding.left + (index * barGroupWidth) + (barGroupWidth / 2);
            const value = positive[index] || 0;

            // Calculate bar height with smooth easing
            const targetHeight = (value / roundedMax) * chartHeight;
            const barHeight = targetHeight * this.easeOutQuart(this.animationProgress);
            const barY = this.padding.top + chartHeight - barHeight;

            // Determine if this bar is active
            const isActive = index === this.selectedIndex || index === this.hoveredIndex;

            // Draw bar with rounded top
            if (barHeight > 0) {
                this.drawRoundedBar(
                    x - barWidth / 2,
                    barY,
                    barWidth,
                    barHeight,
                    isActive ? this.colors.barActive : this.colors.barDefault,
                    barWidth / 2
                );
            }

            // Draw label
            this.ctx.fillStyle = isActive ? this.colors.textDark : this.colors.text;
            this.ctx.font = `${isActive ? '600' : '500'} 11px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(label, x, this.height - 25);

            // Draw tooltip for selected/hovered bar
            if ((isActive || (index === this.hoveredIndex && this.selectedIndex === -1)) && barHeight > 0) {
                this.drawTooltip(x, barY - 8, value);
            }
        });
    }

    roundToNice(value) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        const normalized = value / magnitude;

        if (normalized <= 1) return magnitude;
        if (normalized <= 2) return 2 * magnitude;
        if (normalized <= 5) return 5 * magnitude;
        return 10 * magnitude;
    }

    drawYAxis(maxValue, chartHeight) {
        const steps = 4;
        const stepValue = maxValue / steps;

        for (let i = 0; i <= steps; i++) {
            const value = Math.round(stepValue * i);
            const y = this.padding.top + chartHeight - (chartHeight * (i / steps));

            // Draw grid line
            this.ctx.beginPath();
            this.ctx.strokeStyle = this.colors.grid;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([]);
            this.ctx.moveTo(this.padding.left, y);
            this.ctx.lineTo(this.width - this.padding.right, y);
            this.ctx.stroke();

            // Draw label
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = '11px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.formatNumber(value), this.padding.left - 8, y);
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'k';
        }
        return num.toString();
    }

    drawRoundedBar(x, y, width, height, color, radius) {
        if (height < 1) return;

        radius = Math.min(radius, height / 2, width / 2);

        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.arcTo(x + width, y, x + width, y + radius, radius);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x, y + height);
        this.ctx.lineTo(x, y + radius);
        this.ctx.arcTo(x, y, x + radius, y, radius);
        this.ctx.closePath();

        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    drawTooltip(x, y, value) {
        const text = value.toLocaleString();
        const padding = 8;
        const fontSize = 12;

        this.ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
        const textWidth = this.ctx.measureText(text).width;

        const tooltipWidth = textWidth + padding * 2;
        const tooltipHeight = fontSize + padding * 1.4;
        let tooltipX = x - tooltipWidth / 2;
        const tooltipY = y - tooltipHeight - 6;
        const arrowSize = 5;

        // Keep tooltip within bounds
        tooltipX = Math.max(5, Math.min(this.width - tooltipWidth - 5, tooltipX));

        // Draw tooltip background with shadow
        this.ctx.shadowColor = 'rgba(0,0,0,0.15)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetY = 2;

        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 6);
        this.ctx.fillStyle = this.colors.barActive;
        this.ctx.fill();

        // Draw arrow
        this.ctx.beginPath();
        this.ctx.moveTo(x - arrowSize, tooltipY + tooltipHeight);
        this.ctx.lineTo(x, tooltipY + tooltipHeight + arrowSize);
        this.ctx.lineTo(x + arrowSize, tooltipY + tooltipHeight);
        this.ctx.closePath();
        this.ctx.fill();

        // Reset shadow
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetY = 0;

        // Draw text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2);
    }

    drawLineChart() {
        const { labels, positive } = this.data;
        if (!labels || !positive || labels.length === 0) return;

        const chartWidth = this.width - this.padding.left - this.padding.right;
        const chartHeight = this.height - this.padding.top - this.padding.bottom;

        const maxValue = Math.max(...positive, 1);
        const roundedMax = this.roundToNice(maxValue);
        const pointSpacing = chartWidth / Math.max(1, labels.length - 1);

        // Draw Y-axis
        this.drawYAxis(roundedMax, chartHeight);

        // Calculate points
        const points = positive.map((value, index) => ({
            x: this.padding.left + (index * pointSpacing),
            y: this.padding.top + chartHeight - ((value / roundedMax) * chartHeight * this.easeOutQuart(this.animationProgress)),
            value: value
        }));

        if (points.length === 0) return;

        // Draw gradient fill
        const gradient = this.ctx.createLinearGradient(0, this.padding.top, 0, this.height - this.padding.bottom);
        gradient.addColorStop(0, 'rgba(76, 175, 80, 0.2)');
        gradient.addColorStop(1, 'rgba(76, 175, 80, 0)');

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, this.height - this.padding.bottom);
        points.forEach((point, i) => {
            if (i === 0) {
                this.ctx.lineTo(point.x, point.y);
            } else {
                const prevPoint = points[i - 1];
                const cpX = (prevPoint.x + point.x) / 2;
                this.ctx.bezierCurveTo(cpX, prevPoint.y, cpX, point.y, point.x, point.y);
            }
        });
        this.ctx.lineTo(points[points.length - 1].x, this.height - this.padding.bottom);
        this.ctx.closePath();
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Draw line
        this.ctx.beginPath();
        points.forEach((point, i) => {
            if (i === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                const prevPoint = points[i - 1];
                const cpX = (prevPoint.x + point.x) / 2;
                this.ctx.bezierCurveTo(cpX, prevPoint.y, cpX, point.y, point.x, point.y);
            }
        });

        this.ctx.strokeStyle = this.colors.barActive;
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();

        // Draw points
        points.forEach((point, index) => {
            const isActive = index === this.hoveredIndex || index === this.selectedIndex;

            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, isActive ? 6 : 4, 0, Math.PI * 2);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.fill();
            this.ctx.strokeStyle = this.colors.barActive;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            if (isActive) {
                this.drawTooltip(point.x, point.y - 8, point.value);
            }
        });

        // Draw labels
        labels.forEach((label, index) => {
            if (index >= points.length) return;
            const isActive = index === this.hoveredIndex || index === this.selectedIndex;
            this.ctx.fillStyle = isActive ? this.colors.textDark : this.colors.text;
            this.ctx.font = `${isActive ? '600' : '500'} 11px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(label, points[index].x, this.height - 25);
        });
    }

    easeOutQuart(x) {
        return 1 - Math.pow(1 - x, 4);
    }

    easeOutCubic(x) {
        return 1 - Math.pow(1 - x, 3);
    }
}

// Chart Manager
const chartManager = {
    charts: {},

    create(canvasId, type = 'bar') {
        if (!document.getElementById(canvasId)) {
            console.warn(`Canvas ${canvasId} not found`);
            return null;
        }
        this.charts[canvasId] = new ExpenseChart(canvasId, type);
        return this.charts[canvasId];
    },

    get(canvasId) {
        return this.charts[canvasId];
    },

    updateData(canvasId, data) {
        const chart = this.charts[canvasId];
        if (chart) {
            chart.setData(data);
        }
    },

    setChartType(canvasId, type) {
        const chart = this.charts[canvasId];
        if (chart) {
            chart.type = type;
            if (chart.data) {
                chart.animateIn();
            }
        }
    }
};

// Export
window.chartManager = chartManager;
window.ExpenseChart = ExpenseChart;
