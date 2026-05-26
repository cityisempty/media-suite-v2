import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

const materialsDir = join(os.homedir(), 'Library/Application Support/media-automation-suite/materials');

const packages = [
  { date: '2026-04-20', postId: 'post-001', title: '如何提升自信心？', color: '#FF6B6B' },
  { date: '2026-04-20', postId: 'post-002', title: '焦虑情绪的应对方法', color: '#4ECDC4' },
  { date: '2026-04-21', postId: 'post-001', title: '心理学小知识分享', color: '#95E1D3' }
];

for (const pkg of packages) {
  const packageDir = join(materialsDir, pkg.date, pkg.postId);

  // 创建第一张图片
  const canvas1 = createCanvas(800, 600);
  const ctx1 = canvas1.getContext('2d');

  // 背景渐变
  const gradient = ctx1.createLinearGradient(0, 0, 800, 600);
  gradient.addColorStop(0, pkg.color);
  gradient.addColorStop(1, '#ffffff');
  ctx1.fillStyle = gradient;
  ctx1.fillRect(0, 0, 800, 600);

  // 标题文字
  ctx1.fillStyle = '#333333';
  ctx1.font = 'bold 48px Arial';
  ctx1.textAlign = 'center';
  ctx1.fillText(pkg.title, 400, 300);

  // 保存图片
  const buffer1 = canvas1.toBuffer('image/jpeg', { quality: 0.9 });
  writeFileSync(join(packageDir, 'image-1.jpg'), buffer1);
  console.log(`✓ Created ${pkg.date}/${pkg.postId}/image-1.jpg`);

  // 如果是 post-002，创建第二张图片
  if (pkg.postId === 'post-002') {
    const canvas2 = createCanvas(800, 600);
    const ctx2 = canvas2.getContext('2d');

    ctx2.fillStyle = '#f0f0f0';
    ctx2.fillRect(0, 0, 800, 600);

    ctx2.fillStyle = '#666666';
    ctx2.font = '36px Arial';
    ctx2.textAlign = 'center';
    ctx2.fillText('配图 2', 400, 300);

    const buffer2 = canvas2.toBuffer('image/jpeg', { quality: 0.9 });
    writeFileSync(join(packageDir, 'image-2.jpg'), buffer2);
    console.log(`✓ Created ${pkg.date}/${pkg.postId}/image-2.jpg`);
  }
}

console.log('\n✅ All test images created successfully!');
