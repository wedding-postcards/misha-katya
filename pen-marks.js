/* Twelve deliberately different pen gestures. Coordinates are relative to the heart's centre. */
(() => {
  'use strict';
  // Each cubic carries its own pressure. The final point deliberately misses the starting point.
  const gestures = [
    {
      start: [-.02, -.24],
      curves: [
        [-.35, -.94, -1.04, -.83, -.84, -.15, .82],
        [-.74, .22, -.28, .59, .07, .94, 1.08],
        [.30, .51, .94, .15, .88, -.35, .98],
        [.80, -.91, .31, -.76, .06, -.21, .74]
      ]
    },
    {
      start: [.08, -.13],
      curves: [
        [-.14, -.82, -.98, -.90, -.91, -.31, .95],
        [-.92, .10, -.39, .64, -.12, .89, 1.16],
        [.14, .48, .98, -.02, .93, -.50, .91],
        [.86, -.91, .40, -.56, .12, -.18, .72]
      ],
      echo: { start: [-.65, .23], curve: [-.44, .45, -.23, .71, -.11, .82], alpha: .22 }
    },
    {
      start: [-.07, -.29],
      curves: [
        [-.47, -1.04, -.79, -.69, -.64, -.06, .79],
        [-.56, .28, -.22, .69, .05, 1.03, 1.12],
        [.25, .60, .63, .21, .69, -.22, 1.03],
        [.80, -.88, .30, -.89, -.02, -.19, .70]
      ]
    },
    {
      start: [.03, -.12],
      curves: [
        [-.47, -.78, -1.03, -.48, -.86, .02, 1.02],
        [-.73, .32, -.19, .56, .17, .77, 1.15],
        [.50, .43, 1.07, .16, .99, -.25, .87],
        [.91, -.70, .40, -.59, .08, -.06, .74]
      ]
    },
    {
      start: [.13, -.22],
      curves: [
        [-.25, -.94, -.87, -.92, -.87, -.34, .78],
        [-.92, .12, -.40, .69, -.19, .96, 1.10],
        [.15, .58, .74, .26, .83, -.10, 1.00],
        [.98, -.70, .46, -.86, .18, -.15, .80]
      ],
      echo: { start: [.73, -.42], curve: [.83, -.22, .64, .10, .46, .28], alpha: .18 }
    },
    {
      start: [-.13, -.19],
      curves: [
        [-.38, -.69, -.96, -.73, -.91, -.23, .92],
        [-.80, .19, -.17, .68, .19, .88, 1.14],
        [.40, .37, .82, -.02, .73, -.50, .88],
        [.58, -1.05, .13, -.79, -.07, -.13, .72]
      ]
    },
    {
      start: [.02, -.32],
      curves: [
        [-.34, -.94, -.89, -.67, -.80, -.16, .83],
        [-.75, .20, -.35, .51, -.02, .94, 1.12],
        [.15, .65, .97, .04, .95, -.35, .99],
        [.91, -.79, .44, -.91, .09, -.29, .78]
      ],
      echo: { start: [-.40, .47], curve: [-.30, .56, -.17, .68, -.04, .87], alpha: .24 }
    },
    {
      start: [-.03, -.10],
      curves: [
        [-.20, -.86, -.76, -.85, -.78, -.27, .80],
        [-.88, .18, -.52, .53, -.03, .83, 1.04],
        [.38, .55, .90, .18, .86, -.29, 1.16],
        [.84, -.73, .30, -.74, .03, -.05, .73]
      ]
    },
    {
      start: [.11, -.27],
      curves: [
        [-.18, -.99, -.94, -.73, -.80, -.09, .95],
        [-.74, .23, -.35, .59, .11, .98, 1.12],
        [.40, .63, .82, .12, .71, -.31, .92],
        [.61, -.86, .31, -.69, .16, -.19, .76]
      ]
    },
    {
      start: [-.10, -.25],
      curves: [
        [-.52, -.83, -1.00, -.69, -.89, -.21, .81],
        [-.75, .21, -.10, .56, .29, .74, 1.09],
        [.49, .24, .93, -.06, .83, -.48, 1.02],
        [.72, -.95, .21, -.84, -.04, -.20, .69]
      ],
      echo: { start: [-.78, -.25], curve: [-.74, -.02, -.56, .15, -.38, .28], alpha: .18 }
    },
    {
      start: [.01, -.15],
      curves: [
        [-.29, -.89, -.76, -.64, -.70, -.19, .89],
        [-.66, .16, -.32, .70, -.10, .99, 1.14],
        [.16, .68, .79, .16, .80, -.24, .97],
        [.84, -.87, .28, -.83, .06, -.09, .76]
      ]
    },
    {
      start: [-.02, -.20],
      curves: [
        [-.32, -.70, -.91, -.87, -.94, -.31, .78],
        [-.96, .12, -.40, .62, .03, .81, 1.08],
        [.36, .48, 1.01, .18, .92, -.30, 1.13],
        [.85, -.92, .34, -.66, .04, -.13, .71]
      ]
    }
  ];

  window.drawPenHeart = function drawPenHeart(g, x, y, size = 16, color = '#343c3e', rotation = 0, variant = 0) {
    if (!(size > 0) || !Number.isFinite(size)) return;
    const index = ((Math.trunc(Number(variant) || 0) % gestures.length) + gestures.length) % gestures.length;
    const gesture = gestures[index];
    const width = Math.max(.52, size * .068);
    g.save();
    g.translate(x, y);
    g.rotate(rotation);
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const opacity = g.globalAlpha;
    let point = gesture.start;
    for (let i = 0; i < gesture.curves.length; i += 1) {
      const curve = gesture.curves[i];
      g.lineWidth = width * curve[6];
      g.globalAlpha = opacity * (i === 0 ? .91 : i === 3 ? .88 : .97);
      g.beginPath();
      g.moveTo(point[0] * size, point[1] * size);
      g.bezierCurveTo(curve[0] * size, curve[1] * size, curve[2] * size, curve[3] * size, curve[4] * size, curve[5] * size);
      g.stroke();
      point = [curve[4], curve[5]];
    }
    if (gesture.echo) {
      const echo = gesture.echo;
      g.globalAlpha = opacity * echo.alpha;
      g.lineWidth = width * .52;
      g.beginPath();
      g.moveTo(echo.start[0] * size, echo.start[1] * size);
      g.bezierCurveTo(echo.curve[0] * size, echo.curve[1] * size, echo.curve[2] * size, echo.curve[3] * size, echo.curve[4] * size, echo.curve[5] * size);
      g.stroke();
    }
    g.restore();
  };

  window.BOOK_HEART_GROUPS = {
    '0R': [
      { dx: 0, dy: 0, size: 16, angle: -.13, variant: 5 },
      { dx: 28, dy: -12, size: 7, angle: .19, variant: 2 }
    ],
    '1L': [
      { dx: 0, dy: 0, size: 18, angle: -.20, variant: 0 },
      { dx: 31, dy: -12, size: 8, angle: .16, variant: 7 },
      { dx: 42, dy: 10, size: 6, angle: -.32, variant: 10 }
    ],
    '1R': [
      { dx: 0, dy: 1, size: 17, angle: .17, variant: 4 },
      { dx: 29, dy: -10, size: 9, angle: -.25, variant: 11 }
    ],
    '2L': [
      { dx: 0, dy: 0, size: 19, angle: -.08, variant: 1 },
      { dx: 33, dy: -11, size: 7, angle: .31, variant: 8 },
      { dx: 42, dy: 11, size: 6, angle: -.17, variant: 3 }
    ],
    '3L': [
      { dx: 0, dy: 0, size: 16, angle: -.26, variant: 9 },
      { dx: 28, dy: -12, size: 8, angle: .12, variant: 6 }
    ],
    '5R': [
      { dx: 0, dy: 0, size: 18, angle: .10, variant: 7 },
      { dx: 32, dy: -13, size: 8, angle: -.21, variant: 0 },
      { dx: 43, dy: 9, size: 6, angle: .27, variant: 4 }
    ],
    '6L': [
      { dx: 0, dy: 0, size: 20, angle: -.18, variant: 6 },
      { dx: 34, dy: -10, size: 9, angle: .23, variant: 10 }
    ],
    '6R': [
      { dx: 0, dy: 0, size: 15, angle: .14, variant: 3 },
      { dx: 27, dy: -12, size: 8, angle: -.28, variant: 11 },
      { dx: 39, dy: 10, size: 6, angle: .11, variant: 2 }
    ]
  };
})();
