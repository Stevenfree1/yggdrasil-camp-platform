import { fireEvent, render, screen } from '@testing-library/react';
import { LodgingToolbar } from '../../components/lodging/LodgingToolbar';

describe('LodgingToolbar map downloads', () => {
  it('offers separate camp-only and full-map exports', () => {
    const onExportPng = jest.fn();
    const noop = jest.fn();

    render(
      <LodgingToolbar
        dirtyCount={0}
        saving={false}
        colorMode="HOUSEHOLD"
        canUndo={false}
        canRedo={false}
        hasBackground
        bgAdjust={false}
        onToggleBgAdjust={noop}
        fullscreen={false}
        onToggleFullscreen={noop}
        onAddKind={noop}
        onAddPlug={noop}
        onOpenAddModal={noop}
        onOpenCsvImport={noop}
        onOpenSdrImport={noop}
        onOpenBackground={noop}
        onOpenVersions={noop}
        onExportPng={onExportPng}
        onUndo={noop}
        onRedo={noop}
        onFitToContent={noop}
        onRotateView={noop}
        onColorModeChange={noop}
        layers={{ compass: true, power: false }}
        onToggleLayer={noop}
        onSave={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download camp-only map as PNG' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download full map as PNG' }));

    expect(onExportPng).toHaveBeenNthCalledWith(1, 'camp');
    expect(onExportPng).toHaveBeenNthCalledWith(2, 'full');
  });
});
